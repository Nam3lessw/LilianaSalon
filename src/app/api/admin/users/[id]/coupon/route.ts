import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAdminAuthToken } from "@/lib/auth-server";
import { UpdateCustomerCouponSchema } from "@/lib/validators";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const adminUser = await verifyAdminAuthToken(req);
  if (!adminUser) {
    return NextResponse.json({ error: "Acceso denegado: Se requieren permisos administrativos." }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const body = await req.json();
    const parseResult = UpdateCustomerCouponSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Valor de cupón inválido" }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(id);
    const snap = await userRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const firstPurchaseUsed = parseResult.data.firstPurchaseUsed;
    await userRef.update({
      firstPurchaseUsed,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Audit log
    await adminDb.collection("auditLogs").add({
      action: "USER_COUPON_TOGGLED",
      targetId: id,
      adminUid: adminUser.uid,
      adminEmail: adminUser.email || "",
      firstPurchaseUsed,
      timestamp: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, firstPurchaseUsed });
  } catch (err: any) {
    console.error("Error toggling customer coupon:", err);
    return NextResponse.json({ error: "Error al actualizar estado del cupón" }, { status: 500 });
  }
}
