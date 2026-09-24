"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { 
  CheckCircle2, 
  Clock, 
  ShoppingBag, 
  ShieldCheck, 
  Printer, 
  MessageCircle, 
  ArrowLeft, 
  Gift, 
  Coins, 
  Sparkles,
  Lock,
  Loader2,
  AlertCircle
} from "lucide-react";
import Link from "next/link";

interface OrderItem {
  productId: string;
  productName: string;
  brand?: string;
  volume?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  country: string;
  currency: "GTQ" | "USD";
  items: OrderItem[];
  subtotal: number;
  discount: number;
  wholesaleDiscount?: number;
  couponApplied: boolean;
  couponCode?: string | null;
  total: number;
  pointsEarned: number;
  status: "pendiente" | "completada" | "cancelada";
  notes?: string;
  createdAt: any;
  confirmedAt?: any;
}

export default function OrderVerificationPage() {
  const params = useParams();
  const router = useRouter();
  const orderIdParam = params?.id as string;

  const { isAdmin } = useAuth();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [successActionMsg, setSuccessActionMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!orderIdParam) return;

    const fetchOrder = async () => {
      setLoading(true);
      setError(null);
      const cleanId = orderIdParam.trim();

      try {
        // 1. Carga directa desde Firestore del cliente (rápida, segura y sin fallos de credenciales en servidor)
        if (db) {
          try {
            const docRef = doc(db, "orders", cleanId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
              const data = docSnap.data();
              setOrder({
                id: docSnap.id,
                ...data,
                orderNumber: data.orderNumber || docSnap.id,
              } as OrderDetail);
              setLoading(false);
              return;
            }

            // Si no se encontró por ID directo, buscar por orderNumber (ej. LS-22421)
            const q = query(collection(db, "orders"), where("orderNumber", "==", cleanId));
            const snap = await getDocs(q);
            if (!snap.empty) {
              const firstDoc = snap.docs[0];
              const data = firstDoc.data();
              setOrder({
                id: firstDoc.id,
                ...data,
                orderNumber: data.orderNumber || firstDoc.id,
              } as OrderDetail);
              setLoading(false);
              return;
            }
          } catch (clientDbErr) {
            console.warn("Client Firestore order lookup notice:", clientDbErr);
          }
        }

        // 2. Fallback resiliente a través del endpoint de API
        let idToken: string | undefined;
        if (auth?.currentUser) {
          try {
            idToken = await auth.currentUser.getIdToken();
          } catch (tErr) {
            console.warn("Could not get ID token for order lookup:", tErr);
          }
        }

        const res = await fetch(`/api/orders/${encodeURIComponent(cleanId)}`, {
          headers: {
            ...(idToken ? { "Authorization": `Bearer ${idToken}` } : {})
          }
        });

        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          if (!res.ok) {
            setError(data.error || "No se encontró ningún registro para este pedido. Por favor verifica el enlace.");
            return;
          }
          setOrder(data as OrderDetail);
        } else {
          setError("No se encontró ningún registro para este pedido. Por favor verifica el número o enlace oficial.");
        }
      } catch (err: any) {
        console.error("Error fetching order", err);
        setError("Error al cargar la información del pedido: " + (err.message || "Error de red"));
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderIdParam]);

  // Acción del Admin: "Marcar Compra Efectuada" vía backend seguro con Custom Claims
  const handleMarkAsCompleted = async () => {
    if (!order) return;
    setConfirming(true);
    try {
      const idToken = await auth?.currentUser?.getIdToken();
      if (!idToken) {
        alert("Debes iniciar sesión con una cuenta de administrador autorizada.");
        setConfirming(false);
        return;
      }

      const res = await fetch(`/api/admin/orders/${order.id}/complete`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al confirmar la compra.");
      }

      setOrder(prev => prev ? { ...prev, status: "completada" } : null);
      setSuccessActionMsg(data.message || "¡Compra efectuada exitosamente! El pedido ha sido confirmado, el inventario descontado y los puntos acreditados.");

    } catch (err: any) {
      console.error("Error marking order completed", err);
      alert("Error al confirmar la compra: " + err.message);
    } finally {
      setConfirming(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 size={36} className="animate-spin text-[#C08261]" />
        <p className="text-sm font-medium text-stone-600">Verificando pedido oficial...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-[70vh] max-w-lg mx-auto px-4 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
          <AlertCircle size={28} />
        </div>
        <h2 className="text-xl font-serif font-bold text-gray-900">Pedido No Encontrado</h2>
        <p className="text-xs sm:text-sm text-stone-600">{error || "El identificador del pedido es inválido."}</p>
        <Link
          href="/"
          className="bg-black text-white text-xs font-semibold uppercase tracking-wider px-6 py-2.5 rounded-xl hover:bg-stone-800 transition"
        >
          Volver a la Tienda
        </Link>
      </div>
    );
  }

  const symbol = order.currency === "GTQ" ? "Q" : "$";
  const isPending = order.status === "pendiente";
  const isCompleted = order.status === "completada";

  const formattedDate = order.createdAt?.seconds
    ? new Date(order.createdAt.seconds * 1000).toLocaleString("es-GT", {
        dateStyle: "medium",
        timeStyle: "short"
      })
    : new Date().toLocaleDateString("es-GT");

  return (
    <div className="min-h-screen bg-[#FFFDFB] py-8 sm:py-14 px-3 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Barra superior de navegación */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-stone-600 hover:text-black font-semibold uppercase tracking-wider transition"
          >
            <ArrowLeft size={14} /> Volver a Liliana Salon
          </Link>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold px-3 py-1.5 rounded-xl transition"
          >
            <Printer size={14} /> Imprimir Recibo
          </button>
        </div>

        {/* Panel Administrativo de Acción Rápida (Solo visible para Administradores) */}
        {isAdmin && (
          <div className="bg-gradient-to-r from-stone-900 to-stone-800 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-stone-700 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-[#E0A98B] font-bold flex items-center gap-1.5">
                <Lock size={13} /> Panel de Verificación de Vendedor
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                isCompleted 
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              }`}>
                Estado: {order.status}
              </span>
            </div>

            <p className="text-xs text-stone-300 leading-relaxed">
              Verifica el comprobante bancario del cliente antes de confirmar. Al presionar <strong>&quot;Compra Efectuada&quot;</strong>, el cupón del 15% se quemará automáticamente, se descontarán las unidades del inventario y se le otorgarán los puntos VIP al cliente.
            </p>

            {isPending ? (
              <button
                onClick={handleMarkAsCompleted}
                disabled={confirming}
                className="w-full sm:w-auto bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-stone-950 font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                {confirming ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Procesando pago y quemando cupón...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} /> Marcar Compra Efectuada (Pago Verificado)
                  </>
                )}
              </button>
            ) : (
              <div className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 p-3 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                <span>Esta compra ya fue verificada y finalizada por el administrador.</span>
              </div>
            )}

            {successActionMsg && (
              <div className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs p-3 rounded-xl animate-in fade-in">
                {successActionMsg}
              </div>
            )}
          </div>
        )}

        {/* Tarjeta Oficial del Recibo / Pedido */}
        <div className="bg-white rounded-3xl border border-stone-200 shadow-xl overflow-hidden print:border-none print:shadow-none">
          
          {/* Encabezado del Recibo */}
          <div className="bg-[#FAF3EC] p-6 sm:p-8 border-b border-stone-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase tracking-[0.25em] text-[#A8623D] font-bold block mb-1">
                  Liliana Salon • Verificación Oficial
                </span>
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900 tracking-tight">
                  Pedido #{order.orderNumber}
                </h1>
                <p className="text-xs text-stone-500 mt-1">
                  Registrado el {formattedDate}
                </p>
              </div>

              {/* Sello de Estado */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2">
                {isCompleted ? (
                  <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-xs">
                    <CheckCircle2 size={14} className="text-emerald-600" /> Compra Efectuada
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 border border-amber-300 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-xs">
                    <Clock size={14} className="text-amber-700 animate-pulse" /> Pendiente de Pago
                  </div>
                )}
                <span className="text-[11px] text-stone-500 font-medium">
                  {order.country === "GT" ? "Guatemala (Q)" : "El Salvador ($)"}
                </span>
              </div>
            </div>
          </div>

          {/* Información del Cliente */}
          <div className="p-6 sm:p-8 border-b border-stone-100 bg-[#FAF9F7]/50 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block mb-1">
                Datos del Cliente:
              </span>
              <p className="font-bold text-gray-900 text-sm">{order.customerName}</p>
              {order.customerEmail && (
                <p className="text-stone-600">{order.customerEmail}</p>
              )}
              {order.customerPhone && (
                <p className="text-stone-600">WhatsApp: {order.customerPhone}</p>
              )}
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block mb-1">
                Garantía y Autenticidad:
              </span>
              <p className="text-stone-600 flex items-center gap-1">
                <ShieldCheck size={14} className="text-emerald-600 flex-shrink-0" />
                Precios respaldados por Liliana Salon.
              </p>
              {order.notes && (
                <p className="text-stone-600 mt-1 italic">
                  <strong>Instrucciones:</strong> {order.notes}
                </p>
              )}
            </div>
          </div>

          {/* Tabla de Productos Comprados */}
          <div className="p-6 sm:p-8 space-y-6">
            <h3 className="font-serif text-lg font-bold text-gray-900 flex items-center gap-2">
              <ShoppingBag size={18} className="text-[#A8623D]" /> Desglose de Productos
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-400 uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 font-bold">Producto</th>
                    <th className="py-2.5 font-bold text-center">Cant.</th>
                    <th className="py-2.5 font-bold text-right">Precio Unit.</th>
                    <th className="py-2.5 font-bold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {order.items?.map((item, index) => (
                    <tr key={index} className="hover:bg-stone-50/50">
                      <td className="py-3 pr-2">
                        <span className="font-semibold text-gray-900 block">{item.productName}</span>
                        <span className="text-[10px] text-stone-500">
                          {item.brand}{item.volume ? ` • ${item.volume}` : ""}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-stone-700">
                        x{item.quantity}
                      </td>
                      <td className="py-3 px-2 text-right text-stone-600">
                        {symbol}{item.unitPrice.toFixed(2)}
                      </td>
                      <td className="py-3 pl-2 text-right font-bold text-gray-900">
                        {symbol}{item.totalPrice.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Resumen de Totales */}
            <div className="pt-4 border-t border-stone-200 space-y-2 max-w-xs ml-auto text-xs text-stone-600">
              <div className="flex justify-between">
                <span>Subtotal oficial:</span>
                <span className="font-semibold text-gray-900">{symbol}{order.subtotal.toFixed(2)}</span>
              </div>

              {order.wholesaleDiscount && order.wholesaleDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span className="flex items-center gap-1">
                    <Sparkles size={12} /> Descuento Mayoreo / Docena (10%):
                  </span>
                  <span>-{symbol}{order.wholesaleDiscount.toFixed(2)}</span>
                </div>
              )}

              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span className="flex items-center gap-1">
                    <Gift size={12} /> Cupón 15% (1er producto):
                  </span>
                  <span>-{symbol}{order.discount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-base sm:text-lg font-serif font-bold text-gray-900 pt-2 border-t border-stone-200">
                <span>TOTAL OFICIAL:</span>
                <span className="text-[#A8623D]">{symbol}{order.total.toFixed(2)} {order.currency}</span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1">
                <span className="flex items-center gap-1">
                  <Coins size={12} className="text-[#C08261]" /> Puntos VIP de la compra:
                </span>
                <span className="font-bold text-stone-900">+{order.pointsEarned} pts</span>
              </div>
            </div>
          </div>

          {/* Pie del Recibo */}
          <div className="bg-[#FAF9F7] p-5 sm:p-6 border-t border-stone-200/80 text-center space-y-2">
            <p className="text-xs text-stone-600">
              {isCompleted ? (
                <span className="font-medium text-emerald-800">
                  ✨ ¡Gracias por confiar en Liliana Salon! Tu pedido está listo para ser despachado.
                </span>
              ) : (
                <span>
                  Envía el comprobante de transferencia al WhatsApp oficial (+502 4208-3721) para confirmar el envío de tu paquete.
                </span>
              )}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <a
                href={`https://wa.me/50242083721?text=${encodeURIComponent(`Hola Liliana Salon, tengo una consulta sobre mi pedido #${order.orderNumber}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-[#25D366] font-bold hover:underline"
              >
                <MessageCircle size={14} /> Contactar a Liliana Salon
              </a>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
