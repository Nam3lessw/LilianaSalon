import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuthToken } from "@/lib/auth-server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const rateLimit = checkRateLimit(req, 60, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas consultas. Por favor espera un momento." },
      { status: 429 }
    );
  }

  try {
    const { id } = await context.params;
    if (!id || id.trim().length === 0) {
      return NextResponse.json({ error: "ID de pedido no especificado" }, { status: 400 });
    }

    const cleanId = id.trim();
    let orderDoc = await adminDb.collection("orders").doc(cleanId).get();

    // If not found by direct doc ID, try searching by orderNumber (e.g. LS-12345)
    if (!orderDoc.exists) {
      const snap = await adminDb.collection("orders").where("orderNumber", "==", cleanId).limit(1).get();
      if (!snap.empty) {
        orderDoc = snap.docs[0];
      }
    }

    if (!orderDoc.exists) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const orderData = orderDoc.data() || {};
    const authUser = await verifyAuthToken(req);

    const viewerIsAdmin = Boolean(authUser?.admin);
    const viewerIsOwner = Boolean(
      authUser && (authUser.uid === orderData.customerId || authUser.email === orderData.customerEmail)
    );

    // Format timestamps for JSON serialization
    const createdAtIso = orderData.createdAt?.toDate ? orderData.createdAt.toDate().toISOString() : orderData.createdAt;
    const confirmedAtIso = orderData.confirmedAt?.toDate ? orderData.confirmedAt.toDate().toISOString() : orderData.confirmedAt;

    return NextResponse.json({
      id: orderDoc.id,
      orderNumber: orderData.orderNumber || orderDoc.id,
      customerId: orderData.customerId,
      customerName: orderData.customerName,
      customerEmail: viewerIsAdmin || viewerIsOwner ? orderData.customerEmail : undefined,
      customerPhone: viewerIsAdmin || viewerIsOwner ? orderData.customerPhone : undefined,
      country: orderData.country || "GT",
      currency: orderData.currency || "GTQ",
      items: orderData.items || [],
      subtotal: orderData.subtotal || 0,
      discount: orderData.discount || 0,
      couponApplied: Boolean(orderData.couponApplied),
      couponCode: orderData.couponCode,
      total: orderData.total || 0,
      paymentMethod: orderData.paymentMethod || "Transferencia / Depósito",
      pointsEarned: orderData.pointsEarned || 0,
      status: orderData.status || "pendiente",
      notes: orderData.notes || "",
      createdAt: createdAtIso,
      confirmedAt: confirmedAtIso,
      viewerIsAdmin,
      viewerIsOwner,
    });
  } catch (error: any) {
    console.error("Error fetching order server-side:", error);
    return NextResponse.json({ error: "Error al consultar la orden" }, { status: 500 });
  }
}
