import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID || "liliana-salon";
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (privateKey) {
  privateKey = privateKey.replace(/\\n/g, "\n");
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) privateKey = privateKey.slice(1, -1);
}

const app = getApps().length ? getApps()[0] : initializeApp({
  credential: clientEmail && privateKey ? cert({ projectId, clientEmail, privateKey }) : undefined,
  projectId
});

const db = getFirestore(app);

async function testProductSave() {
  console.log("Testing product saving via Admin SDK...");
  const newProduct = {
    name: "Mask cisteine",
    brand: "Keratech",
    category: "Keratech",
    price: 400.00,
    priceUSD: 51.40,
    oldPrice: null,
    oldPriceUSD: null,
    stock: 50,
    tag: "Top Venta",
    volume: "1000ml",
    description: "Tratamiento capilar intensivo para nutrición profunda.",
    image: "https://images.unsplash.com/photo-1599305090598-fe179d501227?q=80&w=600&auto=format&fit=crop",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  const docRef = await db.collection("products").add(newProduct);
  console.log("Product saved successfully with ID:", docRef.id);

  const snap = await db.collection("products").doc(docRef.id).get();
  console.log("Verified product in Firestore:", snap.data()?.name, "Stock:", snap.data()?.stock);
}

testProductSave()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
  });
