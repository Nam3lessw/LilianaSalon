"use client";
import React, { useState, useEffect, useRef } from "react";
import { 
  MessageCircle, 
  Phone, 
  X, 
  Check, 
  Globe, 
  Coins,
  ChevronUp
} from "lucide-react";
import { useCountry } from "@/context/CountryContext";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";

export default function WhatsAppButton() {
  const { country, countryName, setCountry, currencySymbol } = useCountry();
  const { authModalOpen, customerDrawerOpen } = useAuth();
  const { isCartOpen } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [tooltipHovered, setTooltipHovered] = useState(false);
  const [hasModalOpen, setHasModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const phoneNumber = "50242083721";
  const message = `Hola Liliana Salon, me gustaría recibir asesoría sobre productos y tratamientos desde ${countryName}.`;
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
  const phoneCallUrl = `tel:+${phoneNumber}`;

  // Detect when any modal or drawer is open in the application
  useEffect(() => {
    const checkModal = () => {
      setHasModalOpen(document.body.classList.contains("modal-open"));
    };
    checkModal();
    const observer = new MutationObserver(checkModal);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectCountry = (newCountry: "GT" | "SV") => {
    setCountry(newCountry);
    setTimeout(() => {
      setIsOpen(false);
    }, 350);
  };

  const shouldHide = Boolean(isCartOpen || authModalOpen || customerDrawerOpen || hasModalOpen);

  return (
    <div 
      ref={containerRef}
      className={`fixed bottom-5 right-5 sm:bottom-7 sm:right-7 z-30 flex flex-col items-end pointer-events-none select-none transition-all duration-300 ${
        shouldHide ? "opacity-0 pointer-events-none translate-y-6 scale-90" : "opacity-100"
      }`}
    >
      {/* Menú desplegable hacia arriba (Speed Dial) */}
      <div 
        className={`flex flex-col items-end space-y-2.5 mb-3 transition-all duration-300 ease-out origin-bottom ${
          isOpen 
            ? "opacity-100 translate-y-0 scale-100 pointer-events-auto" 
            : "opacity-0 translate-y-8 scale-90 pointer-events-none"
        }`}
      >
        {/* 1. Opción Moneda: El Salvador (USD $) */}
        <div 
          onClick={() => handleSelectCountry("SV")}
          className="flex items-center gap-2.5 cursor-pointer group transition-transform active:scale-95"
        >
          <div className="bg-white/95 backdrop-blur-sm text-stone-800 text-xs font-semibold py-1.5 px-3 rounded-full shadow-md border border-stone-200/90 flex items-center gap-2 group-hover:border-[#C08261] group-hover:text-black transition">
            <span className="text-base leading-none">🇸🇻</span>
            <span>El Salvador</span>
            <span className="text-stone-500 font-mono text-[11px]">($ USD)</span>
            {country === "SV" && (
              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Check size={11} /> Activo
              </span>
            )}
          </div>
          <button
            type="button"
            aria-label="Seleccionar El Salvador"
            className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-all ${
              country === "SV" 
                ? "bg-[#C08261] text-white ring-2 ring-offset-2 ring-[#C08261] scale-105" 
                : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-100"
            }`}
          >
            <span className="font-bold text-sm">$</span>
          </button>
        </div>

        {/* 2. Opción Moneda: Guatemala (GTQ Q) */}
        <div 
          onClick={() => handleSelectCountry("GT")}
          className="flex items-center gap-2.5 cursor-pointer group transition-transform active:scale-95"
        >
          <div className="bg-white/95 backdrop-blur-sm text-stone-800 text-xs font-semibold py-1.5 px-3 rounded-full shadow-md border border-stone-200/90 flex items-center gap-2 group-hover:border-[#C08261] group-hover:text-black transition">
            <span className="text-base leading-none">🇬🇹</span>
            <span>Guatemala</span>
            <span className="text-stone-500 font-mono text-[11px]">(Q GTQ)</span>
            {country === "GT" && (
              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Check size={11} /> Activo
              </span>
            )}
          </div>
          <button
            type="button"
            aria-label="Seleccionar Guatemala"
            className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-all ${
              country === "GT" 
                ? "bg-[#C08261] text-white ring-2 ring-offset-2 ring-[#C08261] scale-105" 
                : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-100"
            }`}
          >
            <span className="font-bold text-sm">Q</span>
          </button>
        </div>

        {/* 3. Opción: Llamada Telefónica */}
        <a
          href={phoneCallUrl}
          className="flex items-center gap-2.5 group transition-transform active:scale-95"
        >
          <div className="bg-white/95 backdrop-blur-sm text-stone-800 text-xs font-semibold py-1.5 px-3 rounded-full shadow-md border border-stone-200/90 group-hover:border-teal-500 transition">
            <span>Llamar al Salón</span>
            <span className="text-stone-400 font-mono text-[10px] ml-1">(+502 4208-3721)</span>
          </div>
          <div className="w-11 h-11 rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow-lg flex items-center justify-center transition">
            <Phone size={18} />
          </div>
        </a>

        {/* 4. Opción: Chat directo de WhatsApp */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 group transition-transform active:scale-95"
        >
          <div className="bg-white/95 backdrop-blur-sm text-stone-800 text-xs font-semibold py-1.5 px-3 rounded-full shadow-md border border-stone-200/90 group-hover:border-[#25D366] transition flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse"></span>
            <span>Chatear por WhatsApp</span>
          </div>
          <div className="w-11 h-11 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white shadow-lg flex items-center justify-center transition">
            <MessageCircle size={20} />
          </div>
        </a>
      </div>

      {/* Botón Principal Flotante (FAB Trigger) */}
      <div className="flex items-center gap-3">
        {/* Tooltip de sugerencia cuando está cerrado (solo en pantallas grandes) */}
        {!isOpen && (
          <div 
            className={`hidden sm:flex items-center gap-1.5 bg-white/95 backdrop-blur-sm text-stone-800 text-xs font-semibold py-1.5 px-3.5 rounded-full shadow-lg border border-stone-200/80 transition-all duration-300 ${
              tooltipHovered ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2 pointer-events-none"
            }`}
          >
            <span className="text-sm">{country === "GT" ? "🇬🇹" : "🇸🇻"}</span>
            <span>WhatsApp ({currencySymbol})</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          onMouseEnter={() => setTooltipHovered(true)}
          onMouseLeave={() => setTooltipHovered(false)}
          className={`pointer-events-auto cursor-pointer touch-manipulation relative group p-4 sm:p-4 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center active:scale-95 ${
            isOpen 
              ? "bg-stone-900 text-white rotate-90 scale-105" 
              : "bg-[#25D366] hover:bg-[#20ba59] text-white hover:scale-105"
          }`}
          aria-label={isOpen ? "Cerrar menú de contacto" : "Abrir menú de contacto"}
          aria-expanded={isOpen}
        >
          {/* Badge de moneda activa cuando está cerrado */}
          {!isOpen && (
            <span className="absolute -top-1.5 -left-1.5 bg-white text-stone-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md border border-stone-200 flex items-center gap-0.5 animate-in zoom-in-75">
              <span>{country === "GT" ? "🇬🇹" : "🇸🇻"}</span>
              <span>{currencySymbol}</span>
            </span>
          )}

          {/* Ícono dinámico */}
          {isOpen ? (
            <X size={24} className="relative z-10 transition-transform duration-300" />
          ) : (
            <MessageCircle size={26} className="relative z-10 transition-transform duration-300 group-hover:rotate-12" />
          )}
        </button>
      </div>
    </div>
  );
}
