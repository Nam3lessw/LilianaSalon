import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAdminAuthToken } from "@/lib/auth-server";
import { FieldValue } from "firebase-admin/firestore";

export interface CategoryItem {
  id: string;
  name: string;
  image?: string;
  order: number;
  featured: boolean;
  createdAt?: any;
}

const DEFAULT_CATEGORIES: Omit<CategoryItem, "id">[] = [
  { name: "Keratech", image: "https://images.unsplash.com/photo-1599305090598-fe179d501227?q=80&w=400&auto=format&fit=crop", order: 1, featured: true },
  { name: "IvoGa", image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=400&auto=format&fit=crop", order: 2, featured: true },
  { name: "Cuidado Facial", image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=400&auto=format&fit=crop", order: 3, featured: true },
  { name: "Accesorios", image: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?q=80&w=400&auto=format&fit=crop", order: 4, featured: true },
  { name: "Perfumes", image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?q=80&w=400&auto=format&fit=crop", order: 5, featured: true },
  { name: "Tratamientos", image: "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?q=80&w=400&auto=format&fit=crop", order: 6, featured: false }
];

export async function GET() {
  try {
    const snap = await adminDb.collection("categories").get();
    
    // Auto-seed if collection is completely empty
    if (snap.empty) {
      const batch = adminDb.batch();
      const seeded: CategoryItem[] = [];
      for (const cat of DEFAULT_CATEGORIES) {
        const docRef = adminDb.collection("categories").doc();
        batch.set(docRef, {
          ...cat,
          createdAt: FieldValue.serverTimestamp()
        });
        seeded.push({ id: docRef.id, ...cat });
      }
      await batch.commit();
      seeded.sort((a, b) => a.order - b.order);
      return NextResponse.json({ categories: seeded, seeded: true });
    }

    const categories: CategoryItem[] = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || "",
        image: data.image || "",
        order: typeof data.order === "number" ? data.order : 99,
        featured: data.featured === true,
        createdAt: data.createdAt ? data.createdAt.toDate?.()?.toISOString?.() || null : null
      };
    });

    categories.sort((a, b) => a.order - b.order);
    return NextResponse.json({ categories });
  } catch (error: any) {
    console.error("Error in GET /api/categories:", error);
    // Return default categories if database is temporarily unavailable
    const fallback = DEFAULT_CATEGORIES.map((c, i) => ({ id: `default-${i}`, ...c }));
    return NextResponse.json({ categories: fallback, fallback: true });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminUser = await verifyAdminAuthToken(req);
    if (!adminUser) {
      return NextResponse.json(
        { error: "No autorizado. Se requieren credenciales de administrador." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const action = body.action || "create";

    if (action === "seed") {
      // Re-seed default categories
      const batch = adminDb.batch();
      const snap = await adminDb.collection("categories").get();
      // Optional: don't delete existing if already present
      if (snap.empty) {
        for (const cat of DEFAULT_CATEGORIES) {
          const docRef = adminDb.collection("categories").doc();
          batch.set(docRef, {
            ...cat,
            createdAt: FieldValue.serverTimestamp()
          });
        }
        await batch.commit();
      }
      const refreshedSnap = await adminDb.collection("categories").get();
      const list = refreshedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      return NextResponse.json({ success: true, categories: list });
    }

    if (action === "create") {
      const { name, image, featured } = body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ error: "El nombre de la categoría es requerido." }, { status: 400 });
      }

      const snap = await adminDb.collection("categories").get();
      let maxOrder = 0;
      snap.forEach(d => {
        const o = d.data().order;
        if (typeof o === "number" && o > maxOrder) maxOrder = o;
      });

      const newCategory = {
        name: name.trim(),
        image: image || "https://images.unsplash.com/photo-1599305090598-fe179d501227?q=80&w=400&auto=format&fit=crop",
        order: maxOrder + 1,
        featured: Boolean(featured),
        createdAt: FieldValue.serverTimestamp()
      };

      const docRef = await adminDb.collection("categories").add(newCategory);
      return NextResponse.json({ success: true, id: docRef.id, category: newCategory });
    }

    if (action === "reorder") {
      const { orderedIds } = body;
      if (!Array.isArray(orderedIds)) {
        return NextResponse.json({ error: "orderedIds debe ser un arreglo de IDs." }, { status: 400 });
      }

      const batch = adminDb.batch();
      orderedIds.forEach((id: string, index: number) => {
        const docRef = adminDb.collection("categories").doc(id);
        batch.update(docRef, { order: index + 1, updatedAt: FieldValue.serverTimestamp() });
      });
      await batch.commit();

      return NextResponse.json({ success: true, message: "Orden actualizado exitosamente." });
    }

    return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
  } catch (error: any) {
    console.error("Error in POST /api/categories:", error);
    return NextResponse.json({ error: error.message || "Error procesando solicitud de categorías." }, { status: 500 });
  }
}
