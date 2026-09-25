import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "liliana-salon";
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey) {
  privateKey = privateKey.replace(/\\n/g, "\n");
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
}

let app: App;
if (!getApps().length) {
  if (clientEmail && privateKey) {
    app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  } else {
    app = initializeApp({
      projectId,
    });
  }
} else {
  app = getApps()[0];
}

const db = getFirestore(app);
const auth = getAuth(app);

async function runTests() {
  console.log("=========================================");
  console.log("🧪 DIAGNÓSTICO INTEGRAL DE PARÁMETROS FIREBASE");
  console.log(`Proyecto ID: ${projectId}`);
  console.log(`Client Email: ${clientEmail ? "Configurado (OK)" : "Falta"}`);
  console.log("=========================================\n");

  // 1. Test Auth & Admins
  console.log("1. Verificando Firebase Auth & Usuarios con Admin Claim...");
  try {
    const listUsers = await auth.listUsers(10);
    console.log(`   Total usuarios listados: ${listUsers.users.length}`);
    listUsers.users.forEach(u => {
      const isAdmin = u.customClaims?.admin === true;
      console.log(`   - Usuario: ${u.email || u.uid} | Admin Claim: ${isAdmin ? "✅ SÍ (admin: true)" : "❌ NO"}`);
    });
  } catch (err: any) {
    console.error("   ❌ Error en Auth:", err.message);
  }

  // 2. Test Firestore Collections
  console.log("\n2. Verificando Colecciones de Firestore...");
  const collections = ["products", "categories", "orders", "users", "settings"];
  for (const colName of collections) {
    try {
      const snap = await db.collection(colName).get();
      console.log(`   - Colección '${colName}': ✅ ${snap.size} documentos`);
      if (colName === "products" && snap.size > 0) {
        snap.forEach(d => {
          const data = d.data();
          console.log(`     * [${d.id}] ${data.name} | Q${data.price} ($${data.priceUSD}) | Stock: ${data.stock} | Cat: ${data.category}`);
        });
      }
    } catch (err: any) {
      console.error(`   - Colección '${colName}': ❌ Error:`, err.message);
    }
  }

  // 3. Test Writing & Deleting in 'products'
  console.log("\n3. Probando Escritura y Lectura en 'products'...");
  try {
    const testDocRef = await db.collection("products").add({
      name: "__TEST_DIAGNOSTICO__",
      brand: "Keratech",
      category: "Keratech",
      price: 99.99,
      priceUSD: 12.90,
      stock: 1,
      tag: "Test",
      image: "https://example.com/test.jpg",
      createdAt: FieldValue.serverTimestamp()
    });
    console.log(`   ✅ Documento de prueba creado exitosamente: ID ${testDocRef.id}`);

    // Read it back
    const readSnap = await testDocRef.get();
    if (readSnap.exists) {
      console.log(`   ✅ Lectura confirmada: ${readSnap.data()?.name}`);
    }

    // Clean up
    await testDocRef.delete();
    console.log(`   ✅ Documento de prueba eliminado correctamente.`);
  } catch (err: any) {
    console.error("   ❌ Error al escribir en 'products':", err.message);
  }

  console.log("\n=========================================");
  console.log("🏁 DIAGNÓSTICO FINALIZADO");
  console.log("=========================================");
}

runTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Error general en diagnóstico:", err);
    process.exit(1);
  });
