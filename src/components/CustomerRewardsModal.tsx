"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCountry, CountryCode } from "@/context/CountryContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { 
  X, 
  Gift, 
  Sparkles, 
  LogOut, 
  ExternalLink, 
  Copy, 
  Check, 
  Coins, 
  Award,
  Lock,
  ShoppingBag,
  CheckCircle2,
  Clock,
  Printer,
  ChevronRight,
  Loader2,
  Globe
} from "lucide-react";
import Link from "next/link";

interface UserOrder {
  id: string;
  orderNumber: string;
  items: {
    productId: string;
    productName: string;
    brand?: string;
    volume?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  currency: "GTQ" | "USD";
  subtotal: number;
  discount: number;
  couponApplied: boolean;
  couponCode?: string;
  total: number;
  pointsEarned: number;
  status: "pendiente" | "completada" | "cancelada";
  createdAt: any;
}

export default function CustomerRewardsModal() {
  const { 
    user, 
    userProfile, 
    isAdmin, 
    customerDrawerOpen, 
    setCustomerDrawerOpen, 
    logout,
    refreshProfile
  } = useAuth();

  const { country, setCountry } = useCountry();
  const [countryUpdatedNotice, setCountryUpdatedNotice] = useState(false);

  const [activeTab, setActiveTab] = useState<"rewards" | "orders">(isAdmin ? "orders" : "rewards");
  const [copied, setCopied] = useState(false);
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const handleUpdateCountry = async (newCountry: CountryCode) => {
    if (country === newCountry) return;
    setCountry(newCountry);
    setCountryUpdatedNotice(true);
    setTimeout(() => setCountryUpdatedNotice(false), 2500);

    if (user && db) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          country: newCountry
        });
        await refreshProfile();
      } catch (e) {
        console.error("Error saving country preference to Firestore", e);
      }
    }
  };

  useEffect(() => {
    if (isAdmin) {
      setActiveTab("orders");
    }
  }, [isAdmin]);

  // Cargar pedidos del usuario cuando se abre el modal
  useEffect(() => {
    if (!customerDrawerOpen || !user || !db) return;
    const firestoreDb = db;

    const fetchUserOrders = async () => {
      setLoadingOrders(true);
      try {
        const ordersList: UserOrder[] = [];

        // Buscar por email
        if (user.email) {
          const qEmail = query(collection(firestoreDb, "orders"), where("customerEmail", "==", user.email));
          const snapEmail = await getDocs(qEmail);
          snapEmail.forEach(docSnap => {
            ordersList.push({ id: docSnap.id, ...docSnap.data() } as UserOrder);
          });
        }

        // Buscar por UID si no se encontraron o complementar
        if (user.uid) {
          const qUid = query(collection(firestoreDb, "orders"), where("customerId", "==", user.uid));
          const snapUid = await getDocs(qUid);
          snapUid.forEach(docSnap => {
            if (!ordersList.some(o => o.id === docSnap.id)) {
              ordersList.push({ id: docSnap.id, ...docSnap.data() } as UserOrder);
            }
          });
        }

        // Ordenar por fecha descendente
        ordersList.sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });

        setOrders(ordersList);
      } catch (err) {
        console.error("Error fetching user orders", err);
      } finally {
        setLoadingOrders(false);
      }
    };

    fetchUserOrders();
  }, [customerDrawerOpen, user]);

  if (!customerDrawerOpen || !user) return null;

  const points = userProfile?.points || 0;
  const couponCode = userProfile?.welcomeCoupon || "BIENVENIDA15";

  const handleCopyCoupon = () => {
    navigator.clipboard.writeText(couponCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto transition-opacity duration-300 animate-in fade-in"
      onClick={() => setCustomerDrawerOpen(false)}
    >
      <div 
        className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200 relative my-4 sm:my-8 transform transition-all duration-300 ease-out animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón Cerrar */}
        <button 
          onClick={() => setCustomerDrawerOpen(false)}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition"
          aria-label="Cerrar ventana"
        >
          <X size={18} />
        </button>

        {/* Encabezado del Perfil */}
        <div className="bg-[#FAF3EC] p-5 sm:p-7 border-b border-stone-200/80">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#C08261] text-white flex items-center justify-center font-serif text-xl font-bold shadow-xs">
              {(userProfile?.name || user.email || "C")[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-serif font-bold text-gray-900 leading-tight">
                  {isAdmin ? (userProfile?.name || "Administrador") : (userProfile?.name || "Cliente VIP")}
                </h3>
                {isAdmin && (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-300">
                    <Lock size={10} /> Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500">{user.email}</p>
            </div>
          </div>

          {/* Acceso especial para Administrador */}
          {isAdmin && (
            <div className="mt-3.5 pt-3.5 border-t border-stone-200/60 flex items-center justify-between">
              <span className="text-xs text-stone-600 font-medium">Panel de Gestión Liliana Salon:</span>
              <Link 
                href="/admin" 
                onClick={() => setCustomerDrawerOpen(false)}
                className="bg-black text-white px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider hover:bg-stone-800 transition flex items-center gap-1.5 shadow-xs"
              >
                Ir al Panel Admin <ExternalLink size={12} />
              </Link>
            </div>
          )}
          {/* Opción para cambiar País de Entrega & Moneda */}
          <div className="mt-3.5 pt-3.5 border-t border-stone-200/60">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                <Globe size={13} className="text-[#C08261]" /> País de Entrega & Moneda
              </span>
              <span className="text-[10px] text-stone-500 font-medium">
                {country === "GT" ? "Quetzales (Q)" : "Dólares ($)"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleUpdateCountry("GT")}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition ${
                  country === "GT"
                    ? "bg-white border-[#C08261] text-black ring-1 ring-[#C08261] shadow-xs"
                    : "bg-white/50 border-stone-200 text-stone-600 hover:bg-white"
                }`}
              >
                <span>🇬🇹 Guatemala (Q)</span>
                {country === "GT" && <Check size={13} className="text-[#C08261]" />}
              </button>

              <button
                type="button"
                onClick={() => handleUpdateCountry("SV")}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition ${
                  country === "SV"
                    ? "bg-white border-[#C08261] text-black ring-1 ring-[#C08261] shadow-xs"
                    : "bg-white/50 border-stone-200 text-stone-600 hover:bg-white"
                }`}
              >
                <span>🇸🇻 El Salvador ($)</span>
                {country === "SV" && <Check size={13} className="text-[#C08261]" />}
              </button>
            </div>
            {countryUpdatedNotice && (
              <p className="text-[10px] text-emerald-700 font-medium mt-1 text-center animate-in fade-in">
                ✓ País y precios actualizados
              </p>
            )}
          </div>

          {/* Selector de Pestañas: Solo para clientes normales */}
          {!isAdmin ? (
            <div className="flex gap-2 mt-4 pt-2">
              <button
                onClick={() => setActiveTab("rewards")}
                className={`flex-1 py-2 px-3 text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 ${
                  activeTab === "rewards"
                    ? "bg-white text-stone-900 shadow-xs border border-stone-200"
                    : "text-stone-500 hover:text-stone-900"
                }`}
              >
                <Award size={14} className="text-[#C08261]" /> Mis Puntos & Cupón
              </button>
              <button
                onClick={() => setActiveTab("orders")}
                className={`flex-1 py-2 px-3 text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 ${
                  activeTab === "orders"
                    ? "bg-white text-stone-900 shadow-xs border border-stone-200"
                    : "text-stone-500 hover:text-stone-900"
                }`}
              >
                <ShoppingBag size={14} className="text-[#C08261]" /> Mis Compras ({orders.length})
              </button>
            </div>
          ) : (
            <div className="mt-3 text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
              <ShoppingBag size={14} className="text-black" /> Historial de Compras ({orders.length})
            </div>
          )}
        </div>

        {/* Contenido Dinámico de las Pestañas */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          
          {/* TAB 1: PUNTOS Y CUPONES (SOLO CLIENTES, NO ADMIN) */}
          {!isAdmin && activeTab === "rewards" && (
            <div className="space-y-6">
              {/* Tarjeta de Puntos Acumulados */}
              <div className="bg-gradient-to-br from-[#1C1A17] to-[#2E2A25] text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Coins size={100} />
                </div>

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-[0.25em] text-[#E0A98B] font-semibold flex items-center gap-1.5">
                      <Award size={14} /> Club Liliana Salon
                    </span>
                    <span className="text-xs bg-white/10 px-2.5 py-0.5 rounded-full text-stone-300">
                      Puntos de Lealtad
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-5xl font-serif font-bold text-white tracking-tight">
                      {points}
                    </span>
                    <span className="text-sm font-light text-stone-300">PUNTOS VIP</span>
                  </div>

                  <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/10 text-xs text-stone-200 space-y-1">
                    <div className="font-semibold text-white flex items-center gap-1">
                      <Sparkles size={13} className="text-[#E0A98B]" /> ¿Cómo acumular y canjear?
                    </div>
                    <div className="text-[11px] text-stone-300 leading-relaxed">
                      Cada compra te suma puntos: <strong className="text-white">Q10 gastados = 1 punto</strong> ($1.25 = 1 punto). Puedes canjearlos por descuentos en tratamientos o productos en tu próximo pedido.
                    </div>
                  </div>
                </div>
              </div>

              {/* Cupón de Bienvenida 15% OFF */}
              <div className="border border-stone-200 rounded-2xl p-5 bg-[#FAF9F7]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      userProfile?.firstPurchaseUsed
                        ? "bg-stone-200 text-stone-600"
                        : "bg-orange-100 text-[#A06C52]"
                    }`}>
                      {userProfile?.firstPurchaseUsed ? "Cupón Canjeado" : "Tu Cupón Activo"}
                    </span>
                    <h4 className="text-base font-serif font-bold text-gray-900 mt-1.5">
                      15% OFF en 1 Producto
                    </h4>
                    <p className="text-xs text-stone-500 mt-1">
                      {userProfile?.firstPurchaseUsed
                        ? "Ya canjeaste tu cupón de bienvenida en tu primera compra. ¡Sigue acumulando puntos VIP en cada pedido!"
                        : "Aplica automáticamente al producto de mayor valor en tu bolsa o al ordenar por WhatsApp."}
                    </p>
                  </div>
                </div>

                {!userProfile?.firstPurchaseUsed && (
                  <div className="mt-4 flex items-center justify-between bg-white p-3 rounded-xl border border-dashed border-stone-300">
                    <div>
                      <span className="text-[10px] text-stone-400 uppercase tracking-widest block font-medium">Código de cupón</span>
                      <span className="text-sm font-mono font-bold text-black tracking-widest">{couponCode}</span>
                    </div>
                    <button
                      onClick={handleCopyCoupon}
                      className="bg-black hover:bg-stone-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      {copied ? (
                        <>
                          <Check size={14} className="text-emerald-400" /> ¡Copiado!
                        </>
                      ) : (
                        <>
                          <Copy size={14} /> Copiar
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: HISTORIAL DE PEDIDOS Y RECIBOS */}
          {(activeTab === "orders" || isAdmin) && (
            <div className="space-y-4">
              {isAdmin && (
                <div className="bg-[#FAF9F7] border border-stone-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div>
                    <span className="font-bold text-xs uppercase tracking-wider text-stone-900 block flex items-center gap-1.5">
                      <Lock size={12} className="text-[#C08261]" /> Modo Administrador
                    </span>
                    <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
                      Esta cuenta administrativa no requiere cupones ni acumula puntos. Tienes acceso completo para gestionar catálogo, pedidos y clientes en el panel.
                    </p>
                  </div>
                  <Link 
                    href="/admin" 
                    onClick={() => setCustomerDrawerOpen(false)}
                    className="bg-black text-white px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider hover:bg-stone-800 transition flex items-center gap-1.5 whitespace-nowrap self-end sm:self-auto shadow-xs"
                  >
                    Panel Admin <ExternalLink size={12} />
                  </Link>
                </div>
              )}
              {loadingOrders ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2 text-stone-500 text-xs">
                  <Loader2 size={24} className="animate-spin text-[#C08261]" />
                  <span>Cargando tus compras...</span>
                </div>
              ) : orders.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[#FAF3EC] text-[#A8623D] flex items-center justify-center mx-auto">
                    <ShoppingBag size={22} />
                  </div>
                  <h4 className="font-serif text-base font-bold text-gray-900">Aún no tienes compras registradas</h4>
                  <p className="text-xs text-stone-500 max-w-xs mx-auto">
                    Cuando realices un pedido desde el carrito o WhatsApp, aquí podrás ver tu recibo digital oficial y los puntos obtenidos.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((o) => {
                    const symbol = o.currency === "GTQ" ? "Q" : "$";
                    const isCompleted = o.status === "completada";
                    const dateStr = o.createdAt?.seconds 
                      ? new Date(o.createdAt.seconds * 1000).toLocaleDateString("es-GT", {
                          dateStyle: "medium"
                        })
                      : "Reciente";

                    return (
                      <div 
                        key={o.id} 
                        className="bg-[#FAF9F7] border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs hover:border-[#C08261] transition"
                      >
                        {/* Cabecera del pedido */}
                        <div className="flex items-center justify-between border-b border-stone-200/80 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-serif text-sm font-bold text-gray-900">
                                Pedido #{o.orderNumber}
                              </span>
                              <span className="text-[11px] text-stone-400">• {dateStr}</span>
                            </div>
                            <span className="text-[10px] text-stone-500 font-medium">
                              {o.currency === "GTQ" ? "Guatemala (Q)" : "El Salvador ($)"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {isCompleted ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle2 size={11} /> Compra Efectuada
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                <Clock size={11} className="animate-pulse" /> Pendiente de Pago
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Desglose de Productos (sin imágenes, detallado y conciso) */}
                        <div className="space-y-2 py-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                            Productos del Pedido:
                          </span>
                          <div className="space-y-1.5">
                            {o.items?.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-start text-xs">
                                <div className="pr-2">
                                  <span className="font-semibold text-gray-900">{item.quantity}x {item.productName}</span>
                                  {item.volume && (
                                    <span className="text-[10px] text-stone-500 ml-1">({item.volume})</span>
                                  )}
                                  <span className="text-[10px] text-stone-400 block">
                                    Valor unitario: {symbol}{item.unitPrice.toFixed(2)}
                                  </span>
                                </div>
                                <span className="font-bold text-stone-800 whitespace-nowrap">
                                  {symbol}{item.totalPrice.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Desglose Financiero: Subtotal, Descuento, Total y Puntos */}
                        <div className="bg-white p-3 rounded-xl border border-stone-200 text-xs space-y-1">
                          <div className="flex justify-between text-stone-500">
                            <span>Subtotal:</span>
                            <span>{symbol}{o.subtotal?.toFixed(2)}</span>
                          </div>

                          {o.discount > 0 && (
                            <div className="flex justify-between text-emerald-700 font-semibold">
                              <span>Descuento Cupón (15%):</span>
                              <span>-{symbol}{o.discount.toFixed(2)}</span>
                            </div>
                          )}

                          <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-stone-100">
                            <span>Total Pagado:</span>
                            <span className="text-[#A8623D]">{symbol}{o.total?.toFixed(2)} {o.currency}</span>
                          </div>

                          {!isAdmin && o.pointsEarned > 0 && (
                            <div className="flex justify-between text-[11px] text-stone-500 pt-0.5">
                              <span className="flex items-center gap-1">
                                <Coins size={11} className="text-[#C08261]" /> Puntos conseguidos:
                              </span>
                              <span className="font-bold text-stone-800">+{o.pointsEarned} pts</span>
                            </div>
                          )}
                        </div>

                        {/* Enlace para ver/imprimir recibo oficial */}
                        <div className="pt-1 flex justify-end">
                          <Link
                            href={`/pedido/${o.id}`}
                            onClick={() => setCustomerDrawerOpen(false)}
                            className="inline-flex items-center gap-1.5 text-xs text-[#A8623D] font-bold hover:underline"
                          >
                            <Printer size={13} /> Ver Recibo Oficial Completo <ChevronRight size={13} />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Cerrar Sesión */}
          <div className="pt-4 border-t border-stone-100 flex justify-between items-center">
            <span className="text-xs text-stone-400">Sesión activa como {user.email}</span>
            <button
              onClick={logout}
              className="text-xs text-stone-500 hover:text-red-600 flex items-center gap-1 font-medium transition"
            >
              <LogOut size={14} /> Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
