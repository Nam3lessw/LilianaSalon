"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import Link from "next/link";
import { 
  ShoppingBag, 
  Search, 
  ArrowLeft, 
  Clock, 
  CheckCircle2, 
  ChevronRight, 
  Printer, 
  Coins 
} from "lucide-react";

interface RecentOrder {
  id: string;
  orderNumber: string;
  total: number;
  currency: string;
  status: string;
  itemsCount: number;
  createdAt: any;
}

function PedidosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderParam = searchParams.get("id") || searchParams.get("order");

  const { user } = useAuth();
  const [searchCode, setSearchCode] = useState("");
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [lastOrderNum, setLastOrderNum] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Si viene con parámetro ?id=... redirigir directo
    if (orderParam) {
      router.push(`/pedido/${orderParam}`);
      return;
    }

    // Comprobar si hay un último pedido guardado en este dispositivo
    if (typeof window !== "undefined") {
      const savedId = localStorage.getItem("last_order_id");
      const savedNum = localStorage.getItem("last_order_number");
      if (savedId) setLastOrderId(savedId);
      if (savedNum) setLastOrderNum(savedNum);
    }

    // Si el usuario está autenticado, cargar sus pedidos
    if (user?.email && db) {
      setLoading(true);
      const q = query(collection(db, "orders"), where("customerEmail", "==", user.email));
      getDocs(q).then((snap) => {
        const list: RecentOrder[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            orderNumber: data.orderNumber || d.id,
            total: data.total || 0,
            currency: data.currency || "GTQ",
            status: data.status || "pendiente",
            itemsCount: data.items?.length || 0,
            createdAt: data.createdAt
          });
        });
        list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setRecentOrders(list);
      }).catch((e) => {
        console.error("Error loading orders", e);
      }).finally(() => {
        setLoading(false);
      });
    }
  }, [user, orderParam, router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchCode.trim().replace("#", "");
    if (!clean) return;
    router.push(`/pedido/${clean}`);
  };

  return (
    <div className="min-h-[85vh] bg-[#FFFDFB] py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto space-y-8">
        
        {/* Enlace volver */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-stone-600 hover:text-black font-semibold uppercase tracking-wider transition"
          >
            <ArrowLeft size={14} /> Volver a Liliana Salon
          </Link>
        </div>

        {/* Encabezado */}
        <div className="text-center space-y-2">
          <span className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-[#A8623D] font-bold block">
            Liliana Salon
          </span>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900">
            Seguimiento de Pedido
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto leading-relaxed">
            Ingresa tu número de pedido oficial (ej. <strong className="text-black">LS-22421</strong>) o tu código de orden para ver el detalle de compra y tu comprobante digital.
          </p>
        </div>

        {/* Formulario de Búsqueda */}
        <form onSubmit={handleSearch} className="bg-white p-4 sm:p-6 rounded-3xl border border-stone-200 shadow-sm space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
            Número de Pedido Oficial:
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-3.5 text-stone-400" />
              <input
                type="text"
                required
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="Ej. LS-22421 o código de orden"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-none focus:border-black font-mono"
              />
            </div>
            <button
              type="submit"
              className="bg-black text-white px-5 sm:px-7 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-stone-800 transition"
            >
              Consultar
            </button>
          </div>
        </form>

        {/* Acceso rápido al último pedido de este dispositivo */}
        {lastOrderId && (
          <div className="bg-[#FAF3EC] border border-[#E6D0BE] rounded-2xl p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-[#A8623D] tracking-wider block">
                Último pedido generado en este navegador:
              </span>
              <p className="text-xs font-bold text-gray-900 font-mono">
                #{lastOrderNum || lastOrderId}
              </p>
            </div>
            <Link
              href={`/pedido/${lastOrderId}`}
              className="bg-white text-stone-900 border border-stone-300 hover:border-black text-xs font-bold px-3.5 py-2 rounded-xl transition inline-flex items-center gap-1 shadow-2xs"
            >
              Ver Recibo <ChevronRight size={13} />
            </Link>
          </div>
        )}

        {/* Si el usuario tiene pedidos registrados en su cuenta */}
        {recentOrders.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-stone-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Tus Pedidos Recientes ({recentOrders.length})
            </h3>
            <div className="space-y-2.5">
              {recentOrders.map((o) => {
                const symbol = o.currency === "GTQ" ? "Q" : "$";
                const isCompleted = o.status === "completada";

                return (
                  <Link
                    key={o.id}
                    href={`/pedido/${o.id}`}
                    className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 hover:border-[#C08261] transition flex items-center justify-between shadow-2xs block"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-gray-900">
                          #{o.orderNumber}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isCompleted
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-900"
                        }`}>
                          {isCompleted ? "Compra Efectuada" : "Pendiente"}
                        </span>
                      </div>
                      <span className="text-xs text-stone-500 mt-1 block">
                        Total: <strong className="text-black font-semibold">{symbol}{o.total.toFixed(2)}</strong> ({o.itemsCount} productos)
                      </span>
                    </div>
                    <ChevronRight size={16} className="text-stone-400" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function PedidosIndexPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <p className="text-xs uppercase tracking-widest text-stone-500">Cargando...</p>
      </div>
    }>
      <PedidosContent />
    </Suspense>
  );
}
