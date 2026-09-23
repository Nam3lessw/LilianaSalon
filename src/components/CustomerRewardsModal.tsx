"use client";
import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  X, 
  Gift, 
  Sparkles, 
  LogOut, 
  ShieldCheck, 
  ExternalLink, 
  Copy, 
  Check, 
  Coins, 
  Award,
  Lock
} from "lucide-react";
import Link from "next/link";

export default function CustomerRewardsModal() {
  const { 
    user, 
    userProfile, 
    isAdmin, 
    customerDrawerOpen, 
    setCustomerDrawerOpen, 
    logout 
  } = useAuth();

  const [copied, setCopied] = useState(false);

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
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto transition-opacity duration-300 animate-in fade-in"
      onClick={() => setCustomerDrawerOpen(false)}
    >
      <div 
        className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-stone-200 relative my-8 transform transition-all duration-300 ease-out animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón Cerrar */}
        <button 
          onClick={() => setCustomerDrawerOpen(false)}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition"
        >
          <X size={18} />
        </button>

        {/* Encabezado del Perfil */}
        <div className="bg-[#FAF3EC] p-6 sm:p-8 border-b border-stone-200/80">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#C08261] text-white flex items-center justify-center font-serif text-xl font-bold">
              {(userProfile?.name || user.email || "C")[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-serif font-bold text-gray-900">
                  {userProfile?.name || "Cliente VIP"}
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
            <div className="mt-4 pt-4 border-t border-stone-200/60 flex items-center justify-between">
              <span className="text-xs text-stone-600 font-medium">Panel de Gestión Liliana Salon:</span>
              <Link 
                href="/admin" 
                onClick={() => setCustomerDrawerOpen(false)}
                className="bg-black text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider hover:bg-stone-800 transition flex items-center gap-1.5 shadow-sm"
              >
                Ir al Panel Admin <ExternalLink size={12} />
              </Link>
            </div>
          )}
        </div>

        {/* Contenido de Recompensas y Puntos */}
        <div className="p-6 sm:p-8 space-y-6">
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
                <span className="text-sm font-light text-stone-300">PUNTOS</span>
              </div>

              <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/10 text-xs text-stone-200 space-y-1">
                <div className="font-semibold text-white flex items-center gap-1">
                  <Sparkles size={13} className="text-[#E0A98B]" /> ¿Cómo canjear tus puntos?
                </div>
                <div className="text-[11px] text-stone-300 leading-relaxed">
                  Presenta tus puntos en el salón o por WhatsApp. <strong className="text-white">100 puntos = Q15 de descuento</strong> o acumula <strong className="text-white">500 puntos</strong> para canjear un tratamiento o producto gratis.
                </div>
              </div>
            </div>
          </div>

          {/* Cupón de Bienvenida 15% OFF */}
          <div className="border border-stone-200 rounded-2xl p-5 bg-[#FAF9F7]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A06C52] bg-orange-100/80 px-2 py-0.5 rounded">
                  Tu Cupón Activo
                </span>
                <h4 className="text-base font-serif font-bold text-gray-900 mt-1">
                  15% OFF en tu Primer Producto
                </h4>
                <p className="text-xs text-stone-500 mt-1">
                  Aplica automáticamente al ordenar cualquier producto Keratech, IvoGa o tratamiento por WhatsApp.
                </p>
              </div>
            </div>

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
          </div>

          {/* Cerrar Sesión */}
          <div className="pt-2 border-t border-stone-100 flex justify-between items-center">
            <span className="text-xs text-stone-400">Sesión iniciada</span>
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
