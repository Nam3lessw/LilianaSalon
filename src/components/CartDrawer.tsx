"use client";
import React, { useState } from "react";
import { useCart } from "@/context/CartContext";
import { useCountry } from "@/context/CountryContext";
import { useAuth } from "@/context/AuthContext";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  MessageCircle, 
  Gift, 
  Sparkles, 
  ShieldCheck, 
  Coins,
  Loader2
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function CartDrawer() {
  const {
    items,
    isCartOpen,
    setIsCartOpen,
    removeFromCart,
    updateQuantity,
    clearCart,
    subtotal,
    discount,
    wholesaleDiscount,
    isWholesaleDiscountApplied,
    unitsNeededForWholesale,
    totalItems,
    total,
    pointsToEarn,
    applyWelcomeCoupon,
    setApplyWelcomeCoupon,
    canApplyWelcomeCoupon,
    couponDiscountItem,
    // Puntos VIP canjeables
    userPoints,
    canRedeemPoints,
    minPointsForRedemption,
    applyPointsDiscount,
    setApplyPointsDiscount,
    pointsDiscount,
    pointsRedeemed,
    currencySymbol,
    currencyCode,
    getItemUnitPrice
  } = useCart();

  const { country, countryName } = useCountry();
  const { user, userProfile, isAdmin, openAuthModal } = useAuth();
  const router = useRouter();

  // Datos para clientes invitados
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  if (!isCartOpen) return null;

  const effectiveName = userProfile?.name || guestName.trim();
  const effectivePhone = userProfile?.phone || guestPhone.trim();

  const handleCheckoutWhatsApp = async () => {
    if (items.length === 0) return;

    if (!effectiveName && !user) {
      setOrderError("Por favor ingresa tu nombre para identificar tu pedido.");
      return;
    }
    setOrderError(null);
    setSubmittingOrder(true);

    try {
      let idToken: string | undefined;
      if (auth?.currentUser) {
        try {
          idToken = await auth.currentUser.getIdToken();
        } catch (tErr) {
          console.warn("Could not retrieve user ID Token:", tErr);
        }
      }

      let orderId = "";
      let orderNumber = `LS-${Date.now().toString().slice(-5)}`;
      let verifiedTotal = total;
      let verifiedDiscount = discount;
      let verifiedWholesaleDiscount = wholesaleDiscount;
      let verifiedPointsDiscount = pointsDiscount;
      let verifiedPointsRedeemed = pointsRedeemed;
      let verifiedPoints = pointsToEarn;
      const origin = typeof window !== "undefined" ? window.location.origin : "https://liliana-salon.vercel.app";
      let verificationUrl = "";
      let verifiedItems = items.map(i => {
        const uPrice = getItemUnitPrice(i);
        return {
          productId: i.id,
          productName: i.name,
          brand: i.brand || i.category || "Liliana Salon",
          volume: i.volume || "",
          quantity: i.quantity,
          unitPrice: uPrice,
          totalPrice: uPrice * i.quantity
        };
      });

      // 1. Intentar registrar vía API en el servidor
      try {
        const payload = {
          items: items.map(i => ({
            productId: i.id,
            quantity: i.quantity
          })),
          country,
          applyWelcomeCoupon: Boolean(canApplyWelcomeCoupon && applyWelcomeCoupon),
          applyPointsDiscount: Boolean(canRedeemPoints && applyPointsDiscount),
          customerName: effectiveName || "Cliente",
          customerPhone: effectivePhone || "",
          customerEmail: user?.email || "",
          deliveryNotes: deliveryNotes.trim() || ""
        };

        const res = await fetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idToken ? { "Authorization": `Bearer ${idToken}` } : {})
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const orderResult = await res.json();
            orderId = orderResult.orderId;
            orderNumber = orderResult.orderNumber;
            verifiedTotal = orderResult.total;
            verifiedDiscount = orderResult.discount;
            verifiedWholesaleDiscount = orderResult.wholesaleDiscount || wholesaleDiscount;
            verifiedPointsDiscount = orderResult.pointsDiscount || pointsDiscount;
            verifiedPointsRedeemed = orderResult.pointsRedeemed || pointsRedeemed;
            verifiedPoints = orderResult.pointsEarned;
            verificationUrl = orderResult.verificationUrl;
            if (orderResult.items && orderResult.items.length > 0) {
              verifiedItems = orderResult.items;
            }
          }
        }
      } catch (apiErr) {
        console.warn("Notice: Order API route call, using client Firestore fallback:", apiErr);
      }

      // 2. Si la API no devolvió orderId, persistir en Firestore
      if (!orderId && db) {
        try {
          const orderDocData = {
            orderNumber,
            customerId: user?.uid || "guest",
            customerName: effectiveName || "Cliente",
            customerEmail: user?.email || "",
            customerPhone: effectivePhone || "",
            country,
            currency: currencyCode,
            items: verifiedItems,
            subtotal,
            discount: verifiedDiscount,
            wholesaleDiscount: verifiedWholesaleDiscount,
            pointsDiscount: verifiedPointsDiscount,
            pointsRedeemed: verifiedPointsRedeemed,
            couponApplied: Boolean(canApplyWelcomeCoupon && applyWelcomeCoupon && verifiedDiscount > 0),
            couponCode: (canApplyWelcomeCoupon && applyWelcomeCoupon && verifiedDiscount > 0)
              ? (userProfile?.welcomeCoupon || "BIENVENIDA15")
              : null,
            total: verifiedTotal,
            pointsEarned: isAdmin ? 0 : verifiedPoints,
            status: "pendiente",
            notes: deliveryNotes.trim() || "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };

          const docRef = await addDoc(collection(db, "orders"), orderDocData);
          orderId = docRef.id;
          verificationUrl = `${origin}/pedido/${orderId}`;
        } catch (dbErr) {
          console.warn("Client Firestore order save notice:", dbErr);
          orderId = orderNumber;
          verificationUrl = `${origin}/pedido/${orderNumber}`;
        }
      } else if (!verificationUrl) {
        verificationUrl = `${origin}/pedido/${orderId || orderNumber}`;
      }

      // 3. Formatear mensaje limpio de WhatsApp
      const symbol = currencySymbol;
      const itemsListText = verifiedItems
        .map(i => `* ${i.quantity}x ${i.productName}${i.volume ? ` (${i.volume})` : ""} — ${symbol}${i.totalPrice.toFixed(2)}`)
        .join("\n");

      const wholesaleLine = verifiedWholesaleDiscount > 0
        ? `\nDescuento Mayoreo / Docena (10%): -${symbol}${verifiedWholesaleDiscount.toFixed(2)}`
        : "";

      const couponLine = verifiedDiscount > 0
        ? `\nCupón 1er producto (15%): -${symbol}${verifiedDiscount.toFixed(2)}`
        : "";

      const pointsDiscountLine = verifiedPointsDiscount > 0
        ? `\nDescuento Puntos VIP (${verifiedPointsRedeemed} pts): -${symbol}${verifiedPointsDiscount.toFixed(2)}`
        : "";

      const pointsLine = (!isAdmin && verifiedPoints > 0)
        ? `\nPuntos a ganar: +${verifiedPoints} pts`
        : "";

      const notesLine = deliveryNotes.trim() ? `\nNota: ${deliveryNotes.trim()}` : "";

      const whatsappText = 
        `¡Hola Liliana Salon!\n` +
        `Soy ${effectiveName || "Cliente"} desde ${countryName}.\n` +
        `Deseo realizar el pedido #${orderNumber}:\n\n` +
        `${itemsListText}\n` +
        `${wholesaleLine}` +
        `${couponLine}` +
        `${pointsDiscountLine}\n` +
        `TOTAL OFICIAL: ${symbol}${verifiedTotal.toFixed(2)} ${currencyCode}` +
        `${pointsLine}${notesLine}\n\n` +
        `Verificar pedido oficial:\n` +
        `${verificationUrl}\n\n` +
        `¿Me podrían indicar los datos para realizar la transferencia/pago y coordinar el envío? Muchas gracias.`;

      const salonWhatsApp = "50242083721";
      const finalWhatsAppUrl = `https://wa.me/${salonWhatsApp}?text=${encodeURIComponent(whatsappText)}`;

      // Guardar localmente el último pedido para sincronización
      if (typeof window !== "undefined") {
        localStorage.setItem("last_order_id", orderId || orderNumber);
        localStorage.setItem("last_order_number", orderNumber);
      }

      // Limpiar carrito tras generar la orden oficial
      clearCart();
      setIsCartOpen(false);

      // Abrir WhatsApp en pestaña nueva y redirigir al recibo en la actual
      window.open(finalWhatsAppUrl, "_blank");
      router.push(`/pedido/${orderId || orderNumber}`);

    } catch (err: any) {
      console.error("Error creating order", err);
      setOrderError("Ocurrió un error al registrar el pedido: " + (err.message || "Intenta nuevamente."));
    } finally {
      setSubmittingOrder(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end transition-opacity duration-300 animate-in fade-in"
      onClick={() => setIsCartOpen(false)}
    >
      <div 
        className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between overflow-hidden relative animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Carrito */}
        <div className="bg-[#FAF3EC] p-3.5 sm:p-4 border-b border-stone-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center">
              <ShoppingBag size={16} />
            </div>
            <div>
              <h3 className="font-serif text-base font-bold text-gray-900 leading-tight">
                Mi Bolsa de Compras
              </h3>
              <p className="text-[11px] text-stone-500 font-medium">
                {items.length === 1 ? "1 producto" : `${items.length} productos`} • {countryName}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => setIsCartOpen(false)}
            className="w-8 h-8 rounded-full bg-white hover:bg-stone-100 text-stone-600 flex items-center justify-center transition border border-stone-200 cursor-pointer"
            aria-label="Cerrar bolsa"
          >
            <X size={16} />
          </button>
        </div>

        {/* Lista de Productos o Estado Vacío */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#FAF3EC] text-[#A8623D] flex items-center justify-center">
                <ShoppingBag size={30} />
              </div>
              <div>
                <h4 className="font-serif text-lg font-bold text-gray-900 mb-1">
                  Tu bolsa está vacía
                </h4>
                <p className="text-xs text-stone-500 max-w-xs leading-relaxed">
                  Explora nuestros tratamientos profesionales de Keratech e IvoGa y añade tus favoritos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="bg-black text-white text-xs font-semibold uppercase tracking-wider px-6 py-2.5 rounded-xl hover:bg-stone-800 transition cursor-pointer"
              >
                Ver Catálogo
              </button>
            </div>
          ) : (
            <>
              {/* Items en el carrito */}
              <div className="space-y-2.5">
                {items.map((item) => {
                  const unitPrice = getItemUnitPrice(item);
                  const isCouponDiscounted = Boolean(
                    canApplyWelcomeCoupon && 
                    applyWelcomeCoupon && 
                    couponDiscountItem?.id === item.id
                  );

                  return (
                    <div 
                      key={item.id} 
                      className="flex gap-2.5 bg-[#FAF9F7] p-2.5 rounded-2xl border border-stone-200/70 items-center justify-between"
                    >
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-white border border-stone-200 flex-shrink-0">
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          className="w-full h-full object-cover" 
                        />
                      </div>

                      <div className="flex-1 min-w-0 pr-1">
                        <span className="text-[9px] uppercase font-bold text-[#A8623D] tracking-wider block truncate">
                          {item.brand}
                        </span>
                        <h5 className="text-xs font-semibold text-gray-900 leading-snug line-clamp-1">
                          {item.name}
                        </h5>
                        {item.volume && (
                          <span className="text-[10px] text-stone-500 block">
                            {item.volume}
                          </span>
                        )}

                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs font-bold text-gray-900">
                            {currencySymbol}{unitPrice.toFixed(2)}
                          </span>
                          {isCouponDiscounted && (
                            <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                              -15% aplicado
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Controles de cantidad y eliminar */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="text-stone-400 hover:text-red-600 transition p-1 cursor-pointer"
                          title="Eliminar producto"
                        >
                          <Trash2 size={13} />
                        </button>

                        <div className="flex items-center border border-stone-200 rounded-lg bg-white overflow-hidden shadow-2xs">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="p-1 hover:bg-stone-100 text-stone-700 transition cursor-pointer"
                            aria-label="Disminuir"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="px-1.5 text-xs font-bold text-stone-900 min-w-[18px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            disabled={item.stock !== undefined && item.quantity >= item.stock}
                            className={`p-1 transition ${
                              item.stock !== undefined && item.quantity >= item.stock
                                ? "text-stone-300 bg-stone-50 cursor-not-allowed"
                                : "hover:bg-stone-100 text-stone-700 cursor-pointer"
                            }`}
                            aria-label="Aumentar"
                            title={item.stock !== undefined && item.quantity >= item.stock ? `Límite de stock alcanzado (${item.stock})` : "Aumentar cantidad"}
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Banner de Descuento por Mayoreo o Docena (Compacto) */}
              {isWholesaleDiscountApplied ? (
                <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl px-3 py-2 flex items-center justify-between text-xs text-emerald-800 animate-in fade-in">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Sparkles size={13} className="text-emerald-600" /> Descuento Mayoreo Activo (10%)
                  </span>
                  <span className="font-mono font-bold">-{currencySymbol}{wholesaleDiscount.toFixed(2)}</span>
                </div>
              ) : totalItems > 0 && (
                <div className="bg-[#FAF9F7] border border-stone-200/80 rounded-xl px-3 py-1.5 flex items-center justify-between text-[11px] text-stone-600">
                  <span className="flex items-center gap-1.5">
                    <span>📦</span>
                    <span>Lleva <strong>12+ unidades</strong> para 10% Mayoreo</span>
                  </span>
                  <span className="text-[#A8623D] font-bold text-[10px]">
                    Faltan {unitsNeededForWholesale} {unitsNeededForWholesale === 1 ? "ud" : "uds"}
                  </span>
                </div>
              )}

              {/* Cupón 15% de Bienvenida (Solo visible si está disponible para aplicar) */}
              {!isAdmin && canApplyWelcomeCoupon && (
                <div className="bg-[#FAF3EC] border border-[#E8D6C6] rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                    <Gift size={13} className="text-[#A8623D]" /> Cupón Bienvenida 15% ({couponDiscountItem?.name ? couponDiscountItem.name.slice(0, 18) + "..." : "1er producto"})
                  </span>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={applyWelcomeCoupon} 
                      onChange={(e) => setApplyWelcomeCoupon(e.target.checked)}
                      className="w-4 h-4 text-[#A8623D] rounded border-stone-300 focus:ring-[#A8623D]"
                    />
                    <span className="text-[11px] font-bold text-[#A8623D]">
                      {applyWelcomeCoupon ? `-${currencySymbol}${discount.toFixed(2)}` : "Aplicar"}
                    </span>
                  </label>
                </div>
              )}

              {/* HUD DE CANJE DE PUNTOS VIP (Mínimo 250 puntos requeridos) */}
              {!isAdmin && user && (
                canRedeemPoints ? (
                  <div className={`rounded-xl border p-2.5 transition-all ${
                    applyPointsDiscount 
                      ? "bg-amber-50/70 border-amber-300 shadow-2xs" 
                      : "bg-[#FAF9F7] border-stone-200"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Coins size={15} className="text-[#C08261]" />
                        <div>
                          <span className="text-xs font-bold text-stone-900 block">
                            Puntos VIP ({userPoints} pts disponibles)
                          </span>
                          <span className="text-[10px] text-stone-500">
                            Equivalente a -{currencySymbol}{pointsDiscount.toFixed(2)} de descuento
                          </span>
                        </div>
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={applyPointsDiscount}
                          onChange={(e) => setApplyPointsDiscount(e.target.checked)}
                          className="w-4 h-4 text-[#A8623D] rounded border-stone-300 focus:ring-[#A8623D]"
                        />
                        <span className="text-xs font-bold text-[#A8623D]">
                          {applyPointsDiscount ? `-${currencySymbol}${pointsDiscount.toFixed(2)}` : "Canjear"}
                        </span>
                      </label>
                    </div>
                  </div>
                ) : userPoints > 0 ? (
                  <div className="bg-[#FAF9F7] border border-stone-200/70 rounded-xl px-3 py-1.5 text-[11px] text-stone-500 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Coins size={12} className="text-[#C08261]" />
                      <span>Tienes <strong>{userPoints} pts VIP</strong></span>
                    </span>
                    <span className="text-stone-400 text-[10px]">
                      Mínimo 250 pts para canjear (faltan {minPointsForRedemption - userPoints} pts)
                    </span>
                  </div>
                ) : null
              )}

              {/* Si no está logeado: aviso sutil */}
              {!user && !isAdmin && (
                <div className="bg-stone-50 border border-stone-200/70 rounded-xl px-3 py-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>¿Primera compra? Inicia sesión para 15% OFF y puntos.</span>
                  <button
                    type="button"
                    onClick={() => openAuthModal("login")}
                    className="font-bold text-[#B85728] underline hover:text-black transition ml-1"
                  >
                    Entrar
                  </button>
                </div>
              )}

              {/* Información del Cliente (Simplificada y limpia) */}
              <div className="space-y-1.5 pt-1">
                {user ? (
                  <div className="bg-stone-50 px-3 py-2 rounded-xl border border-stone-200/80 text-xs flex items-center justify-between">
                    <span className="font-semibold text-gray-800 truncate">
                      {userProfile?.name || user.email}
                    </span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                      Identificado
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <input 
                      type="text" 
                      placeholder="Tu nombre completo *"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-stone-200 focus:outline-none focus:border-[#C08261]"
                    />
                    <input 
                      type="tel" 
                      placeholder="WhatsApp de contacto (opcional)"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-stone-200 focus:outline-none focus:border-[#C08261]"
                    />
                  </div>
                )}

                <input 
                  type="text" 
                  placeholder="Dirección o instrucción de entrega (opcional)"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-200 focus:outline-none focus:border-[#C08261]"
                />
              </div>

              {orderError && (
                <div className="p-2.5 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                  {orderError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Resumen Financiero y Botón de Pedido */}
        {items.length > 0 && (
          <div className="p-3.5 sm:p-4 bg-white border-t border-stone-200 space-y-2.5">
            <div className="space-y-1.5 text-xs text-stone-600">
              {/* Mostrar desglose solo si hay descuentos activos */}
              {(wholesaleDiscount > 0 || discount > 0 || pointsDiscount > 0) && (
                <>
                  <div className="flex justify-between text-stone-500">
                    <span>Subtotal oficial:</span>
                    <span className="font-semibold text-gray-800">{currencySymbol}{subtotal.toFixed(2)}</span>
                  </div>
                  {wholesaleDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span className="flex items-center gap-1">
                        <Sparkles size={11} className="text-emerald-600" /> Mayoreo (10%):
                      </span>
                      <span>-{currencySymbol}{wholesaleDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span className="flex items-center gap-1">
                        <Gift size={11} className="text-[#A8623D]" /> Cupón Bienvenida (15%):
                      </span>
                      <span>-{currencySymbol}{discount.toFixed(2)}</span>
                    </div>
                  )}
                  {pointsDiscount > 0 && (
                    <div className="flex justify-between text-amber-800 font-semibold">
                      <span className="flex items-center gap-1">
                        <Coins size={11} className="text-[#C08261]" /> Puntos VIP ({pointsRedeemed} pts):
                      </span>
                      <span>-{currencySymbol}{pointsDiscount.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}

              {/* Total y Puntos en la MISMA línea compacta */}
              <div className="flex items-baseline justify-between pt-1 border-t border-stone-200">
                <span className="text-xs uppercase tracking-wider font-bold text-gray-900">Total a Pagar:</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-base sm:text-lg font-serif font-bold text-gray-900">
                    {currencySymbol}{total.toFixed(2)} <span className="text-[11px] font-sans text-stone-500 font-normal">{currencyCode}</span>
                  </span>
                  {!isAdmin && pointsToEarn > 0 && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap">
                      +{pointsToEarn} pts
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Botón WhatsApp limpio: Sin repetir el total */}
            <button
              type="button"
              onClick={handleCheckoutWhatsApp}
              disabled={submittingOrder}
              className="w-full bg-[#25D366] hover:bg-[#20ba59] active:scale-[0.98] text-white py-3 px-4 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all duration-200 disabled:opacity-60 cursor-pointer touch-manipulation"
            >
              {submittingOrder ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Registrando pedido...
                </>
              ) : (
                <>
                  <MessageCircle size={18} /> Pedir por WhatsApp
                </>
              )}
            </button>

            <p className="text-[10px] text-stone-400 text-center flex items-center justify-center gap-1">
              <ShieldCheck size={12} className="text-emerald-600" />
              Precios oficiales verificados en servidor • Enlace de compra incluido
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
