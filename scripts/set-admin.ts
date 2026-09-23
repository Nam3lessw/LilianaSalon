/**
 * SCRIPT ADMINISTRATIVO SEGURO — ASIGNACIÓN DE PRIVILEGIOS DE ADMINISTRADOR
 * 
 * Uso:
 *   npx tsx scripts/set-admin.ts <email_o_uid>
 *   npx tsx scripts/set-admin.ts remove <email_o_uid>
 * 
 * Este script utiliza Firebase Admin SDK para asignar de forma criptográfica
 * el Custom Claim { admin: true } directamente al usuario en Firebase Authentication.
 */

import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getAuth, UserRecord } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

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

const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Uso del comando:
  npm run set-admin -- <email_o_uid>
  npm run set-admin -- remove <email_o_uid>

Ejemplos:
  npm run set-admin -- lilianasalon@gmail.com
  npm run set-admin -- W1xYz890AbCdEfGhIjKlMnOpQrSt
`);
    process.exit(1);
  }

  let isRemove = false;
  let identifier = args[0];

  if (args[0] === "remove" || args[0] === "--remove") {
    isRemove = true;
    identifier = args[1];
  }

  if (!identifier) {
    console.error("❌ Error: Debes especificar el correo electrónico o UID del usuario.");
    process.exit(1);
  }

  try {
    let user: UserRecord;

    if (identifier.includes("@")) {
      console.log(`Buscando usuario por correo: ${identifier}...`);
      user = await auth.getUserByEmail(identifier.trim());
    } else {
      console.log(`Buscando usuario por UID: ${identifier}...`);
      user = await auth.getUser(identifier.trim());
    }

    if (isRemove) {
      // Quitar privilegios
      await auth.setCustomUserClaims(user.uid, { admin: false });
      await db.collection("users").doc(user.uid).set(
        {
          role: "customer",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      console.log(`✅ Privilegios de administrador REVOCADOS para ${user.email} (${user.uid}).`);
    } else {
      // Asignar Custom Claim admin: true
      await auth.setCustomUserClaims(user.uid, { admin: true });
      await db.collection("users").doc(user.uid).set(
        {
          role: "admin",
          name: user.displayName || user.email?.split("@")[0] || "Administrador Liliana Salon",
          email: user.email,
          points: 0,
          firstPurchaseUsed: true,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      console.log(`
========================================================================
✅ ¡ÉXITO! Privilegios de Administrador asignados correctamente.
========================================================================
Usuario:       ${user.email}
UID:           ${user.uid}
Custom Claims: { admin: true }
Rol Firestore: "admin"

El usuario ahora puede iniciar sesión en: /admin/login
(Si el usuario tenía una sesión abierta, debe cerrar sesión e ingresar nuevamente para refrescar el token de Firebase Auth).
========================================================================
`);
    }
  } catch (error: any) {
    console.error("❌ Error ejecutando set-admin:", error.message || error);
    process.exit(1);
  }
}

main();
