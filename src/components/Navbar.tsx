"use client";
import Link from "next/link";
import { User, Gift, Award, Lock, Sparkles, Globe, ChevronDown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCountry } from "@/context/CountryContext";
import { useState } from "react";

export default function Navbar() {
  const { 
    user, 
    userProfile, 
    isAdmin, 
    openAuthModal, 
    setCustomerDrawerOpen 
  } = useAuth();

  const { country, setCountry, countryFlag, currencySymbol } = useCountry();
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);

  return (
    <header className="w-full sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-stone-200">
      {/* Top Banner de Oferta y Selector de País */}
      <div className="bg-[#FAF3EC] text-stone-800 text-[11px] sm:text-xs py-2 px-3 sm:px-6 border-b border-stone-200/60 flex items-center justify-between font-medium">
        <div className="flex items-center gap-1.5 mx-auto sm:mx-0">
          <Sparkles size={12} className="text-[#C08261] flex-shrink-0" />
          <span className="truncate">
            Envíos en <strong className="font-semibold text-black">Guatemala 🇬🇹 & El Salvador 🇸🇻</strong> • -15% en tu 1ra compra
          </span>
          {!user && (
            <button
              onClick={() => openAuthModal("register")}
              className="hidden sm:inline underline text-black font-bold hover:text-[#C08261] transition ml-1"
            >
              Crear Cuenta
            </button>
          )}
        </div>

        {/* Selector de País / Moneda */}
        <div className="relative">
          <button
            onClick={() => setCountryMenuOpen(!countryMenuOpen)}
            className="flex items-center gap-1.5 bg-white/80 hover:bg-white text-stone-700 px-2.5 py-1 rounded-full border border-stone-200 shadow-xs text-xs font-semibold transition"
          >
            <span>{countryFlag}</span>
            <span>{country === "GT" ? "GT (Q)" : "SV ($)"}</span>
            <ChevronDown size={12} className="text-stone-400" />
          </button>

          {countryMenuOpen && (
            <div 
              className="absolute right-0 top-full mt-1.5 bg-white border border-stone-200 rounded-xl shadow-xl py-1.5 z-50 w-44 animate-in fade-in zoom-in-95 duration-150"
              onMouseLeave={() => setCountryMenuOpen(false)}
            >
              <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-stone-400 font-bold border-b border-stone-100">
                Selecciona tu país
              </div>
              <button
                onClick={() => {
                  setCountry("GT");
                  setCountryMenuOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-stone-50 transition ${
                  country === "GT" ? "font-bold text-[#C08261] bg-[#FAF3EC]/50" : "text-stone-700"
                }`}
              >
                <span className="flex items-center gap-2">🇬🇹 Guatemala</span>
                <span className="text-stone-400 text-[11px]">Quetzal (Q)</span>
              </button>
              <button
                onClick={() => {
                  setCountry("SV");
                  setCountryMenuOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-stone-50 transition ${
                  country === "SV" ? "font-bold text-[#C08261] bg-[#FAF3EC]/50" : "text-stone-700"
                }`}
              >
                <span className="flex items-center gap-2">🇸🇻 El Salvador</span>
                <span className="text-stone-400 text-[11px]">Dólar ($)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20">
          {/* Left section: Info móvil / desktop */}
          <div className="flex items-center space-x-2 text-xs text-stone-500">
            <span className="hidden lg:inline-block font-light text-stone-400 uppercase tracking-widest text-[11px]">
              Cuidado Capilar Profesional
            </span>
          </div>

          {/* Center section: Logo */}
          <div className="flex-shrink-0 flex items-center justify-center">
            <Link href="/" className="text-xl sm:text-3xl font-serif tracking-[0.18em] sm:tracking-[0.2em] text-gray-900 font-medium">
              LILIANA SALON
            </Link>
          </div>

          {/* Right section: Cuenta de Usuario & Puntos */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {user ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Botón de Puntos */}
                <button
                  onClick={() => setCustomerDrawerOpen(true)}
                  className="bg-[#FAF3EC] border border-stone-200 hover:border-[#C08261] text-stone-800 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold flex items-center gap-1 transition shadow-xs"
                >
                  <Award size={13} className="text-[#C08261]" />
                  <span>{userProfile?.points || 0} pts</span>
                </button>

                {/* Acceso Admin */}
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="bg-black hover:bg-stone-800 text-white px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold uppercase tracking-wider flex items-center gap-1 shadow-xs transition"
                  >
                    <Lock size={11} />
                    <span className="hidden sm:inline">Admin</span>
                  </Link>
                )}

                {/* Perfil Icon */}
                <button
                  onClick={() => setCustomerDrawerOpen(true)}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center text-xs font-bold transition border border-stone-200"
                >
                  {(userProfile?.name || user.email || "U")[0].toUpperCase()}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => openAuthModal("register")}
                  className="flex items-center gap-1 bg-[#FAF3EC] text-stone-800 hover:bg-[#F3E5D8] px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold tracking-wider uppercase border border-stone-200 transition"
                >
                  <Gift size={12} className="text-[#C08261]" />
                  <span>15% OFF</span>
                </button>
                <button
                  onClick={() => openAuthModal("login")}
                  className="text-stone-600 hover:text-black text-xs font-semibold uppercase flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-stone-50 transition"
                >
                  <User size={15} />
                  <span className="hidden sm:inline">Ingresar</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Categories navigation (Responsive scrollable with no scrollbar) */}
        <div className="flex space-x-6 sm:space-x-10 sm:justify-center py-2.5 sm:py-3 text-[11px] sm:text-xs font-semibold tracking-[0.15em] sm:tracking-[0.18em] text-stone-700 uppercase overflow-x-auto border-t border-stone-100 scrollbar-none">
          <Link href="/#catalogo" className="hover:text-[#C08261] transition whitespace-nowrap flex-shrink-0">Keratech</Link>
          <Link href="/#catalogo" className="hover:text-[#C08261] transition whitespace-nowrap flex-shrink-0">IvoGa</Link>
          <Link href="/#catalogo" className="hover:text-[#C08261] transition whitespace-nowrap flex-shrink-0">Cuidado Facial</Link>
          <Link href="/#catalogo" className="hover:text-[#C08261] transition whitespace-nowrap flex-shrink-0">Accesorios</Link>
          <Link href="/#catalogo" className="hover:text-[#C08261] transition whitespace-nowrap flex-shrink-0">Ofertas</Link>
        </div>
      </div>
    </header>
  );
}
