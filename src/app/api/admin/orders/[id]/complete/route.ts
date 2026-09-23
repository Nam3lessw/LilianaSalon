import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAdminAuthToken } from "@/lib/auth-server";
import { checkRateLimit } from "@/lib/rate-limit";
import { FieldValue, Transaction, DocumentReference } from "firebase-admin/firestore";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // 1. Rate limiting
  const rateLimit = checkRateLimit(req, 30, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Demasiadas peticiones administrativas." }, { status: 429 });
  }

  // 2. Strict Custom Claims authorization
  const adminUser = await verifyAdminAuthToken(req);
  if (!adminUser) {
    return NextResponse.json(
      { error: "Acceso denegado: Se requieren permisos administrativos verificados." },
      { status: 403 }
    );
  }

  try {
    const { id } = await context.params;
    if (!id || id.trim().length === 0) {
      return NextResponse.json({ error: "ID de pedido no especificado" }, { status: 400 });
    }

    const orderRef = adminDb.collection("orders").doc(id.trim());

    // 3. Atomic Firestore Transaction for Idempotency, Inventory & Points
    const transactionResult = await adminDb.runTransaction(async (transaction: Transaction) => {
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists) {
        throw new Error("ORDER_NOT_FOUND");
      }

      const orderData = orderSnap.data() || {};

      // Check if already completed (Idempotency guarantee)
      if (orderData.status === "completada") {
        return {
          alreadyCompleted: true,
          orderNumber: orderData.orderNumber,
        };
      }

      // Check all products and calculate new inventory without race conditions
      const productUpdates: Array<{ ref: DocumentReference; newStock: number }> = [];

      for (const item of orderData.items || []) {
        if (item.productId) {
          const prodRef = adminDb.collection("products").doc(item.productId);
          const prodSnap = await transaction.get(prodRef);
          if (prodSnap.exists) {
            const currentStock = Number(prodSnap.data()?.stock) || 0;
            // Prevent negative stock
            const newStock = Math.max(0, currentStock - (Number(item.quantity) || 1));
            productUpdates.push({ ref: prodRef, newStock });
          }
        }
      }

      // Customer account update (points and first purchase coupon burn)
      let userUpdate: { ref: DocumentReference; data: Record<string, any> } | null = null;
      if (
        orderData.customerId &&
        orderData.customerId !== "guest" &&
        orderData.customerId !== "manual"
      ) {
        const userRef = adminDb.collection("users").doc(orderData.customerId);
        const userSnap = await transaction.get(userRef);
        if (userSnap.exists) {
          const userData = userSnap.data() || {};
          const currentPoints = Number(userData.points) || 0;
          const pointsEarned = Number(orderData.pointsEarned) || 0;
          const updates: Record<string, any> = {
            points: currentPoints + pointsEarned,
            updatedAt: FieldValue.serverTimestamp(),
          };

          if (orderData.couponApplied) {
            updates.firstPurchaseUsed = true;
          }

          userUpdate = { ref: userRef, data: updates };
        }
      }

      // Execute all atomic writes
      for (const p of productUpdates) {
        transaction.update(p.ref, { stock: p.newStock, updatedAt: FieldValue.serverTimestamp() });
      }

      if (userUpdate) {
        transaction.update(userUpdate.ref, userUpdate.data);
      }

      transaction.update(orderRef, {
        status: "completada",
        confirmedAt: FieldValue.serverTimestamp(),
        confirmedBy: adminUser.email || adminUser.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Write immutable audit log
      const auditRef = adminDb.collection("auditLogs").doc();
      transaction.set(auditRef, {
        action: "ORDER_COMPLETED",
        targetId: id,
        adminUid: adminUser.uid,
        adminEmail: adminUser.email || "",
        orderNumber: orderData.orderNumber || id,
        total: orderData.total || 0,
        currency: orderData.currency || "GTQ",
        timestamp: FieldValue.serverTimestamp(),
      });

      return {
        alreadyCompleted: false,
        orderNumber: orderData.orderNumber || id,
      };
    });

    return NextResponse.json({
      success: true,
      message: transactionResult.alreadyCompleted
        ? `El pedido #${transactionResult.orderNumber} ya se encontraba completado.`
        : `¡Pedido #${transactionResult.orderNumber} marcado como Compra Efectuada exitosamente!`,
      alreadyCompleted: transactionResult.alreadyCompleted,
    });
  } catch (error: any) {
    console.error("Error completing order in transaction:", error);
    if (error.message === "ORDER_NOT_FOUND") {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Error interno al completar el pedido. Se mantuvo la consistencia de inventario." },
      { status: 500 }
    );
  }
}
