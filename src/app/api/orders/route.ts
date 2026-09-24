import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuthToken } from "@/lib/auth-server";
import { CreateOrderSchema } from "@/lib/validators";
import { checkRateLimit } from "@/lib/rate-limit";
import { convertGTQtoUSD, convertUSDtoGTQ } from "@/lib/currency";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  // 1. Rate limiting (15 order creations per minute per IP)
  const rateLimit = checkRateLimit(req, 15, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Por favor espera un momento antes de volver a intentar." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  try {
    const rawBody = await req.json();
    const parseResult = CreateOrderSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Datos de pedido inválidos", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const authUser = await verifyAuthToken(req);

    // 2. Determine customer identity and coupon eligibility server-side
    let customerId = "guest";
    let customerEmail = data.customerEmail || "";
    let customerName = data.customerName;
    let canUseWelcomeCoupon = false;
    let isUserAdmin = false;

    if (authUser) {
      customerId = authUser.uid;
      customerEmail = authUser.email || customerEmail;
      isUserAdmin = authUser.admin;

      // Query user doc from Firestore server-side
      const userSnap = await adminDb.collection("users").doc(authUser.uid).get();
      if (userSnap.exists) {
        const userData = userSnap.data();
        customerName = customerName || userData?.name || "Cliente";
        // Check if first purchase coupon has already been used
        const alreadyUsed = userData?.firstPurchaseUsed === true;
        if (!isUserAdmin && !alreadyUsed && data.applyWelcomeCoupon) {
          canUseWelcomeCoupon = true;
        }
      }
    }

    // 3. Fetch official product details and prices from Firestore
    const currency = data.country === "GT" ? "GTQ" : "USD";
    const orderItems: Array<{
      productId: string;
      productName: string;
      brand: string;
      volume: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }> = [];

    let subtotal = 0;
    let highestUnitPrice = 0;

    for (const item of data.items) {
      const prodDoc = await adminDb.collection("products").doc(item.productId).get();
      if (!prodDoc.exists) {
        return NextResponse.json(
          { error: `El producto seleccionado ya no está disponible en el catálogo.` },
          { status: 400 }
        );
      }

      const prodData = prodDoc.data() || {};
      const availableStock = prodData.stock !== undefined ? Number(prodData.stock) : 99;
      if (item.quantity > availableStock) {
        return NextResponse.json(
          { error: `No hay suficiente stock para "${prodData.name || "el producto"}". Stock disponible: ${availableStock}.` },
          { status: 400 }
        );
      }

      const officialPriceGTQ = Number(prodData.price) || 0;
      let officialPriceUSD = Number(prodData.priceUSD);
      if (!officialPriceUSD || officialPriceUSD <= 0) {
        officialPriceUSD = convertGTQtoUSD(officialPriceGTQ);
      }

      const unitPrice = currency === "GTQ" ? officialPriceGTQ : officialPriceUSD;
      const roundedUnitPrice = Math.round(unitPrice * 100) / 100;
      const itemTotal = Math.round(roundedUnitPrice * item.quantity * 100) / 100;

      if (roundedUnitPrice > highestUnitPrice) {
        highestUnitPrice = roundedUnitPrice;
      }

      subtotal += itemTotal;
      orderItems.push({
        productId: item.productId,
        productName: String(prodData.name || "Producto"),
        brand: String(prodData.brand || prodData.category || "Liliana Salon"),
        volume: String(prodData.volume || ""),
        quantity: item.quantity,
        unitPrice: roundedUnitPrice,
        totalPrice: itemTotal,
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;

    // 4. Server-side wholesale discount calculation: 10% for 12+ total items or 12+ of a product (Docena / Mayoreo)
    const totalOrderUnits = data.items.reduce((sum, it) => sum + it.quantity, 0);
    const isWholesaleEligible = totalOrderUnits >= 12 || data.items.some(it => it.quantity >= 12);
    let wholesaleDiscount = 0;
    if (isWholesaleEligible) {
      wholesaleDiscount = Math.round(subtotal * 0.10 * 100) / 100;
    }

    // 5. Server-side welcome coupon discount calculation: 15% discount applies to 1 unit of highest priced item
    let discount = 0;
    if (canUseWelcomeCoupon && highestUnitPrice > 0) {
      discount = Math.round(highestUnitPrice * 0.15 * 100) / 100;
    }

    const total = Math.max(0, Math.round((subtotal - wholesaleDiscount - discount) * 100) / 100);

    // 6. Server-side points calculation (1 pt per Q10 or 1 pt per $1.25)
    let pointsEarned = 0;
    if (authUser && !isUserAdmin) {
      pointsEarned = currency === "GTQ" ? Math.floor(total / 10) : Math.floor(total / 1.25);
    }

    // 7. Generate order code and write order document in Firestore
    const orderNumber = `LS-${Date.now().toString().slice(-5)}`;
    const newOrderData = {
      orderNumber,
      customerId,
      customerName,
      customerEmail,
      customerPhone: data.customerPhone || "",
      country: data.country,
      currency,
      items: orderItems,
      subtotal,
      discount,
      wholesaleDiscount,
      couponApplied: canUseWelcomeCoupon && discount > 0,
      couponCode: canUseWelcomeCoupon && discount > 0 ? "BIENVENIDA15" : null,
      total,
      paymentMethod: "Transferencia / Depósito",
      pointsEarned,
      status: "pendiente",
      notes: data.deliveryNotes || "",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection("orders").add(newOrderData);

    const origin = req.headers.get("origin") || "https://liliana-salon.vercel.app";
    const verificationUrl = `${origin}/pedido/${docRef.id}`;

    return NextResponse.json({
      success: true,
      orderId: docRef.id,
      orderNumber,
      total,
      subtotal,
      discount,
      wholesaleDiscount,
      pointsEarned,
      currency,
      verificationUrl,
      items: orderItems,
      couponApplied: canUseWelcomeCoupon && discount > 0,
    });
  } catch (error: any) {
    console.error("Error creating order server-side:", error);
    return NextResponse.json(
      { error: "Ocurrió un error al procesar el pedido. Por favor intenta de nuevo." },
      { status: 500 }
    );
  }
}
