import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAdminAuthToken } from "@/lib/auth-server";
import { ProductSchema } from "@/lib/validators";
import { FieldValue } from "firebase-admin/firestore";

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
    const id = body.id as string | undefined;

    const parseResult = ProductSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Datos de producto no válidos.", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const productData = {
      ...parseResult.data,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (id) {
      // Update existing product
      await adminDb.collection("products").doc(id).set(productData, { merge: true });
      return NextResponse.json({ success: true, id, message: "Producto actualizado exitosamente." });
    } else {
      // Create new product
      const newDocRef = await adminDb.collection("products").add({
        ...productData,
        createdAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true, id: newDocRef.id, message: "Producto creado exitosamente." });
    }
  } catch (error: any) {
    console.error("Error in POST /api/admin/products:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar el producto en el servidor." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const adminUser = await verifyAdminAuthToken(req);
    if (!adminUser) {
      return NextResponse.json(
        { error: "No autorizado. Se requieren credenciales de administrador." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "El ID del producto es requerido." }, { status: 400 });
    }

    await adminDb.collection("products").doc(id).delete();
    return NextResponse.json({ success: true, message: "Producto eliminado exitosamente." });
  } catch (error: any) {
    console.error("Error in DELETE /api/admin/products:", error);
    return NextResponse.json(
      { error: error.message || "Error al eliminar el producto en el servidor." },
      { status: 500 }
    );
  }
}
