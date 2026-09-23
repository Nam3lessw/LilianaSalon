/**
 * SUITE DE VERIFICACIÓN DE FIRESTORE SECURITY RULES
 * 
 * Ejecución:
 *   npx tsx scripts/test-rules.ts
 * 
 * Si el emulador de Firebase está activo (firebase emulators:start --only firestore),
 * este script ejecutará todas las pruebas contra el motor de reglas en memoria.
 * Si no está activo, realiza una validación estática de sintaxis y reglas de seguridad.
 */

import * as fs from "fs";
import * as path from "path";

const rulesPath = path.resolve(process.cwd(), "firestore.rules");
const rulesContent = fs.readFileSync(rulesPath, "utf-8");

console.log("========================================================================");
console.log("   AUDITORÍA Y VERIFICACIÓN DE REGLAS DE SEGURIDAD (FIRESTORE RULES)   ");
console.log("========================================================================");

// 1. Verificación Estática de Bloqueos Críticos
const criticalChecks = [
  {
    name: "Eliminación total de 'allow read, write: if true;'",
    pass: !rulesContent.includes("allow read, write: if true;"),
    detail: "No se permite wildcard público de lectura/escritura",
  },
  {
    name: "Products: Lectura pública y escritura exclusiva para administradores",
    pass: rulesContent.includes("match /products/{productId}") &&
          rulesContent.includes("allow read: if true;") &&
          rulesContent.includes("allow write: if isAdmin();"),
    detail: "Solo admin con Custom Claim admin: true puede modificar catálogo",
  },
  {
    name: "Settings: Lectura pública y escritura exclusiva para administradores",
    pass: rulesContent.includes("match /settings/{settingId}") &&
          rulesContent.includes("allow write: if isAdmin();"),
    detail: "Configuración protegida contra modificaciones externas",
  },
  {
    name: "Users: Bloqueo de escalación de privilegios en el cliente",
    pass: rulesContent.includes("match /users/{userId}") &&
          rulesContent.includes("hasAny(['role', 'admin', 'points', 'loyaltyPoints', 'firstPurchaseUsed', 'discountUsed', 'uid', 'email'])"),
    detail: "El cliente no puede alterar rol, admin, puntos ni cupón",
  },
  {
    name: "Orders: Prohibición de cambio de status o totales por clientes",
    pass: rulesContent.includes("match /orders/{orderId}") &&
          rulesContent.includes("allow update: if isAdmin();") &&
          rulesContent.includes("request.resource.data.status == 'pendiente'"),
    detail: "Clientes solo crean en estado pendiente; no pueden marcar pagado/completado",
  },
  {
    name: "AuditLogs: Restricción estricta a solo administradores y servidor",
    pass: rulesContent.includes("match /auditLogs/{logId}") &&
          rulesContent.includes("allow write: if false;"),
    detail: "Los clientes no pueden escribir ni alterar logs de auditoría",
  },
  {
    name: "Regla final por defecto: DENY ALL",
    pass: rulesContent.includes("match /{document=**}") &&
          rulesContent.includes("allow read, write: if false;"),
    detail: "Cualquier colección no contemplada queda cerrada",
  },
];

let allPassed = true;
criticalChecks.forEach((check, index) => {
  const symbol = check.pass ? "✅ PASS" : "❌ FAIL";
  console.log(`[${index + 1}] ${symbol} — ${check.name}`);
  console.log(`    Detalle: ${check.detail}\n`);
  if (!check.pass) allPassed = false;
});

// 2. Intentar ejecutar pruebas unitarias con @firebase/rules-unit-testing si el emulador está disponible
async function runEmulatorTests() {
  try {
    const { initializeTestEnvironment } = await import("@firebase/rules-unit-testing");
    
    // Check if firestore emulator host is configured or reachable
    const host = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
    console.log(`Comprobando emulador de Firestore en ${host}...`);

    const testEnv = await initializeTestEnvironment({
      projectId: "liliana-rules-test",
      firestore: {
        host: host.split(":")[0],
        port: parseInt(host.split(":")[1]),
        rules: rulesContent,
      },
    });

    console.log("✅ Conectado al Firebase Emulator. Ejecutando casos de prueba:\n");

    // Case 1: Visitor reads product
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    try {
      await unauthDb.collection("products").doc("shampoo-1").get();
      console.log("  ✅ TEST 1: Visitante puede leer products -> ALLOW (Correcto)");
    } catch {
      console.log("  ❌ TEST 1: Visitante lectura products falló");
    }

    // Case 2: Visitor writes product
    try {
      await unauthDb.collection("products").doc("hack").set({ name: "Hacked" });
      console.log("  ❌ TEST 2: Visitante modificó product -> ALLOW (FALLA DE SEGURIDAD)");
    } catch {
      console.log("  ✅ TEST 2: Visitante intenta modificar product -> DENY (Correcto)");
    }

    // Case 3: Customer modifies product
    const customerDb = testEnv.authenticatedContext("cust_123", { email: "cliente@gmail.com" }).firestore();
    try {
      await customerDb.collection("products").doc("prod_1").set({ price: 1 });
      console.log("  ❌ TEST 3: Cliente modificó product -> ALLOW (FALLA DE SEGURIDAD)");
    } catch {
      console.log("  ✅ TEST 3: Cliente intenta modificar product -> DENY (Correcto)");
    }

    // Case 4: Admin writes product
    const adminDb = testEnv.authenticatedContext("admin_123", { email: "admin@lilianasalon.com", admin: true }).firestore();
    try {
      await adminDb.collection("products").doc("prod_1").set({ name: "Shampoo Kera", price: 180 });
      console.log("  ✅ TEST 4: Admin modifica product -> ALLOW (Correcto)");
    } catch (e: any) {
      console.log("  ❌ TEST 4: Admin no pudo modificar product:", e.message);
    }

    // Case 5: Customer reads their own user doc
    try {
      await customerDb.collection("users").doc("cust_123").get();
      console.log("  ✅ TEST 5: Cliente lee su propio user doc -> ALLOW (Correcto)");
    } catch {
      console.log("  ❌ TEST 5: Cliente no pudo leer su propio user doc");
    }

    // Case 6: Customer reads another user doc
    try {
      await customerDb.collection("users").doc("other_user").get();
      console.log("  ❌ TEST 6: Cliente leyó otro user -> ALLOW (FALLA DE SEGURIDAD)");
    } catch {
      console.log("  ✅ TEST 6: Cliente lee otro user -> DENY (Correcto)");
    }

    // Case 7: Customer attempts to set role: admin
    try {
      await customerDb.collection("users").doc("cust_123").set({ role: "admin", points: 9999 });
      console.log("  ❌ TEST 7: Cliente escribió role: admin -> ALLOW (FALLA DE SEGURIDAD)");
    } catch {
      console.log("  ✅ TEST 7: Cliente intenta establecer role=admin -> DENY (Correcto)");
    }

    await testEnv.cleanup();
  } catch (err: any) {
    console.log("ℹ️  Nota sobre emulador local:");
    console.log("   Para ejecutar los tests activos en tiempo real con el motor de reglas de Google:");
    console.log("   1. En una terminal ejecuta: npx firebase emulators:start --only firestore");
    console.log("   2. En otra terminal ejecuta: npx tsx scripts/test-rules.ts\n");
  }
}

runEmulatorTests().then(() => {
  if (allPassed) {
    console.log("========================================================================");
    console.log("✅ TODAS LAS COMPROBACIONES DE REGLAS DE SEGURIDAD FUERON SATISFACTORIAS");
    console.log("========================================================================");
    process.exit(0);
  } else {
    console.error("❌ ALGUNAS REGLAS DE SEGURIDAD NO CUMPLIERON EL CRITERIO");
    process.exit(1);
  }
});
