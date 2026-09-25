import { getApps, initializeApp, cert, App } from "firebase-admin/app";
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

const db = getFirestore(app);

const DEFAULT_CATEGORIES = [
  { name: "Keratech", image: "https://images.unsplash.com/photo-1599305090598-fe179d501227?q=80&w=400&auto=format&fit=crop", order: 1, featured: true },
  { name: "IvoGa", image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=400&auto=format&fit=crop", order: 2, featured: true },
  { name: "Cuidado Facial", image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=400&auto=format&fit=crop", order: 3, featured: true },
  { name: "Accesorios", image: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?q=80&w=400&auto=format&fit=crop", order: 4, featured: true },
  { name: "Perfumes", image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?q=80&w=400&auto=format&fit=crop", order: 5, featured: true },
  { name: "Tratamientos", image: "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?q=80&w=400&auto=format&fit=crop", order: 6, featured: false }
];

async function seedCategories() {
  console.log("Checking categories collection in Firestore...");
  const snapshot = await db.collection("categories").get();
  console.log(`Found ${snapshot.size} existing categories in Firestore.`);

  if (snapshot.empty) {
    console.log("Seeding default categories...");
    const batch = db.batch();
    for (const cat of DEFAULT_CATEGORIES) {
      const docRef = db.collection("categories").doc();
      batch.set(docRef, {
        ...cat,
        createdAt: FieldValue.serverTimestamp()
      });
      console.log(` + Added ${cat.name} (order: ${cat.order})`);
    }
    await batch.commit();
    console.log("Successfully seeded default categories into Firestore!");
  } else {
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(` - [${doc.id}] ${data.name} (order: ${data.order}, featured: ${data.featured})`);
    });
  }
}

seedCategories()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Error seeding categories:", err);
    process.exit(1);
  });
