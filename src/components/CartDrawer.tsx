"use client";
import React, { useState } from "react";
import { useCart } from "@/context/CartContext";
import { useCountry } from "@/context/CountryContext";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
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
  ExternalLink,
  Coins,
  Loader2
} from "lucide-react";
import Link from "next/link";
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
    total,
    pointsToEarn,
    applyWelcomeCoupon,
    setApplyWelcomeCoupon,
    canApplyWelcomeCoupon,
    couponDiscountItem,
    currencySymbol,
    currencyCode,
    getItemUnitPrice
  } = useCart();

  const { country, countryName } = useCountry();
  const { user, userProfile, openAuthModal } = useAuth();
  const router = useRouter();

  // Datos para clientes invitados
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  if (!isCartOpen) return null;

  const effectiveName = userProfile?.name || guestName.trim();
  const effectivePhone = guestPhone.trim();

  const handleCheckoutWhatsApp = async () => {
    if (items.length === 0) return;

    if (!effectiveName && !user) {
      setOrderError("Por favor ingresa tu nombre para identificar tu pedido.");
      return;
    }
    setOrderError(null);
    setSubmittingOrder(true);

    try {
      const orderNumber = `LS-${Date.now().toString().slice(-5)}`;
      const orderItems = items.map(item => {
        const unitPrice = getItemUnitPrice(item);
        return {
          productId: item.id,
          productName: item.name,
          brand: item.brand || item.category || "Liliana Salon",
          volume: item.volume || "",
          quantity: item.quantity,
          unitPrice,
          totalPrice: unitPrice * item.quantity
        };
      });

      const orderData = {
        orderNumber,
        customerId: user?.uid || "guest",
        customerName: effectiveName || "Cliente",
        customerEmail: user?.email || "",
        customerPhone: effectivePhone || "",
        country: country, // "GT" o "SV"
        currency: currencyCode, // "GTQ" o "USD"
        items: orderItems,
        subtotal,
        discount,
        couponApplied: Boolean(canApplyWelcomeCoupon && applyWelcomeCoupon && discount > 0),
        couponCode: (canApplyWelcomeCoupon && applyWelcomeCoupon && discount > 0)
          ? (userProfile?.welcomeCoupon || "BIENVENIDA15")
          : null,
        total,
        pointsEarned: pointsToEarn,
        status: "pendiente", // "pendiente" | "completada" | "cancelada"
        notes: deliveryNotes.trim() || "",
        createdAt: serverTimestamp()
      };

      let orderId = "";
      if (db) {
        const docRef = await addDoc(collection(db, "orders"), orderData);
        orderId = docRef.id;
      } else {
        // Fallback local en caso de desconexión
        orderId = orderNumber;
      }

      // Generar URL inalterable del pedido para verificación del vendedor y cliente
      const origin = typeof window !== "undefined" ? window.location.origin : "https://liliana-salon.vercel.app";
      const verificationUrl = `${origin}/pedido/${orderId}`;

      // Formatear mensaje limpio de WhatsApp sin caracteres que se corrompan
      const symbol = currencySymbol;
      const itemsListText = orderItems
        .map(i => `• ${i.quantity}x *${i.productName}*${i.volume ? ` (${i.volume})` : ""} — ${symbol}${i.totalPrice.toFixed(2)}`)
        .join("\n");

      const couponLine = (canApplyWelcomeCoupon && applyWelcomeCoupon && discount > 0)
        ? `\n🎁 *Cupón 1er producto (15%):* -${symbol}${discount.toFixed(2)}`
        : "";

      const notesLine = deliveryNotes.trim() ? `\n📝 *Nota:* ${deliveryNotes.trim()}` : "";

      const whatsappText = 
        `¡Hola Liliana Salon! 👋\n` +
        `Soy *${effectiveName || "Cliente"}* desde ${countryName}.\n` +
        `Deseo realizar el pedido *#${orderNumber}*:\n\n` +
        `${itemsListText}${couponLine}\n\n` +
        `💰 *TOTAL OFICIAL:* *${symbol}${total.toFixed(2)} ${currencyCode}*\n` +
        `⭐ *Puntos a ganar:* +${pointsToEarn} pts${notesLine}\n\n` +
        `🔗 *Verificar pedido oficial:* \n${verificationUrl}\n\n` +
        `¿Me podrían indicar los datos para realizar la transferencia/pago y coordinar el envío? Muchas gracias. ✨`;

      const salonWhatsApp = country === "GT" ? "50242083721" : "50242083721";
      const finalWhatsAppUrl = `https://wa.me/${salonWhatsApp}?text=${encodeURIComponent(whatsappText)}`;

      // Limpiar carrito tras generar la orden oficial
      clearCart();
      setIsCartOpen(false);

      // Abrir WhatsApp en pestaña nueva y redirigir al recibo en la actual
      window.open(finalWhatsAppUrl, "_blank");
      router.push(`/pedido/${orderId}`);

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
        <div className="bg-[#FAF3EC] p-4 sm:p-5 border-b border-stone-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-stone-900 text-white flex items-center justify-center">
              <ShoppingBag size={18} />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-gray-900 leading-tight">
                Mi Bolsa de Compras
              </h3>
              <p className="text-[11px] text-stone-500 font-medium">
                {items.length === 1 ? "1 producto seleccionado" : `${items.length} productos seleccionados`} • {countryName}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setIsCartOpen(false)}
            className="w-8 h-8 rounded-full bg-white hover:bg-stone-200 text-stone-600 flex items-center justify-center transition border border-stone-200"
            aria-label="Cerrar bolsa"
          >
            <X size={18} />
          </button>
        </div>

        {/* Lista de Productos o Estado Vacío */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
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
                onClick={() => setIsCartOpen(false)}
                className="bg-black text-white text-xs font-semibold uppercase tracking-wider px-6 py-2.5 rounded-xl hover:bg-stone-800 transition"
              >
                Ver Catálogo
              </button>
            </div>
          ) : (
            <>
              {/* Items en el carrito */}
              <div className="space-y-3">
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
                      className="flex gap-3 bg-[#FAF9F7] p-3 rounded-2xl border border-stone-200/70 items-center justify-between"
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border border-stone-200 flex-shrink-0">
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          className="w-full h-full object-cover" 
                        />
                      </div>

                      <div className="flex-1 min-w-0 pr-1">
                        <span className="text-[10px] uppercase font-bold text-[#A8623D] tracking-wider block truncate">
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

                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-bold text-gray-900">
                            {currencySymbol}{unitPrice.toFixed(2)}
                          </span>
                          {isCouponDiscounted && (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                              -15% en 1 ud
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Controles de cantidad y eliminar */}
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-stone-400 hover:text-red-600 transition p-1"
                          title="Eliminar producto"
                        >
                          <Trash2 size={13} />
                        </button>

                        <div className="flex items-center border border-stone-200 rounded-lg bg-white overflow-hidden shadow-2xs">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="p-1 hover:bg-stone-100 text-stone-700 transition"
                            aria-label="Disminuir"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="px-2 text-xs font-bold text-stone-900 min-w-[20px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="p-1 hover:bg-stone-100 text-stone-700 transition"
                            aria-label="Aumentar"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Banner de Cupón 15% OFF */}
              {canApplyWelcomeCoupon ? (
                <div className="bg-[#F8EFE7] border border-[#E7D0BD] rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#A8623D] flex items-center gap-1.5">
                      <Gift size={14} /> Cupón de Bienvenida (15% OFF)
                    </span>
                    <label className="flex items-center cursor-pointer gap-1.5">
                      <input 
                        type="checkbox" 
                        checked={applyWelcomeCoupon} 
                        onChange={(e) => setApplyWelcomeCoupon(e.target.checked)}
                        className="w-4 h-4 text-[#A8623D] rounded border-stone-300 focus:ring-[#A8623D]"
                      />
                      <span className="text-[11px] font-semibold text-stone-800">Aplicar</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-stone-600 leading-tight">
                    Aplica automáticamente al producto de mayor valor ({couponDiscountItem?.name}): <strong className="text-[#A8623D]">-{currencySymbol}{discount.toFixed(2)}</strong>.
                  </p>
                </div>
              ) : !user ? (
                <div className="bg-[#FAF6F2] border border-stone-200 rounded-2xl p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-gray-900 block text-[11px]">
                      ¿Es tu primera compra?
                    </span>
                    <span className="text-[10px] text-stone-500">
                      Crea tu cuenta para aplicar 15% OFF en 1 producto.
                    </span>
                  </div>
                  <button
                    onClick={() => openAuthModal("register")}
                    className="text-[11px] font-bold text-[#B85728] underline hover:text-black transition"
                  >
                    Crear cuenta
                  </button>
                </div>
              ) : userProfile?.firstPurchaseUsed ? (
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-[11px] text-stone-500 flex items-center gap-1.5">
                  <Coins size={13} className="text-[#C08261]" />
                  <span>Tu cupón ya fue utilizado. ¡Esta compra te suma <strong>+{pointsToEarn} puntos VIP</strong>!</span>
                </div>
              ) : null}

              {/* Información del Cliente */}
              <div className="pt-2 border-t border-stone-100 space-y-2">
                <span className="text-[10px] uppercase tracking-wider font-bold text-stone-400 block">
                  Información para tu entrega
                </span>
                {user ? (
                  <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-gray-900 block">{userProfile?.name || "Cliente Registrado"}</span>
                      <span className="text-stone-500 text-[11px]">{user.email}</span>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Identificado
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input 
                      type="text" 
                      placeholder="Tu nombre completo *"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-stone-200 focus:outline-none focus:border-[#C08261]"
                    />
                    <input 
                      type="tel" 
                      placeholder="WhatsApp / Teléfono de contacto (opcional)"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-stone-200 focus:outline-none focus:border-[#C08261]"
                    />
                  </div>
                )}

                <input 
                  type="text" 
                  placeholder="Instrucción de entrega o dirección (opcional)"
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
          <div className="p-4 sm:p-5 bg-white border-t border-stone-200 space-y-3">
            <div className="space-y-1.5 text-xs text-stone-600">
              <div className="flex justify-between">
                <span>Subtotal oficial:</span>
                <span className="font-semibold text-gray-900">{currencySymbol}{subtotal.toFixed(2)}</span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span className="flex items-center gap-1">
                    <Sparkles size={12} /> Descuento Bienvenida (15%):
                  </span>
                  <span>-{currencySymbol}{discount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm sm:text-base font-serif font-bold text-gray-900 pt-2 border-t border-stone-200">
                <span>TOTAL A PAGAR:</span>
                <span className="text-[#A8623D]">{currencySymbol}{total.toFixed(2)} {currencyCode}</span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-stone-500 pt-0.5">
                <span className="flex items-center gap-1">
                  <Coins size={12} className="text-[#C08261]" /> Puntos VIP que acumulas:
                </span>
                <span className="font-bold text-stone-800">+{pointsToEarn} pts</span>
              </div>
            </div>

            <button
              onClick={handleCheckoutWhatsApp}
              disabled={submittingOrder}
              className="w-full bg-[#25D366] hover:bg-[#20ba59] active:scale-[0.98] text-white py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all duration-200 disabled:opacity-60"
            >
              {submittingOrder ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Registrando pedido oficial...
                </>
              ) : (
                <>
                  <MessageCircle size={18} /> Pedir por WhatsApp ({currencySymbol}{total.toFixed(2)})
                </>
              )}
            </button>

            <p className="text-[10px] text-stone-400 text-center flex items-center justify-center gap-1">
              <ShieldCheck size={12} className="text-emerald-600" />
              Precios oficiales verificados en servidor • Enlace antifraude incluido
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
