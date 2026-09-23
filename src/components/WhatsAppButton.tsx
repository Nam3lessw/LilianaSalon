"use client";
import { MessageCircle } from "lucide-react";
import { useState } from "react";

export default function WhatsAppButton() {
  const phoneNumber = "50242083721";
  const message = "Hola Liliana Salon, me gustaría recibir información sobre los productos y tratamientos.";
  const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

  const [hovered, setHovered] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 sm:bottom-7 sm:right-7 z-50 flex items-center gap-3">
      {/* Tooltip flotante con transición suave */}
      <div 
        className={`hidden sm:flex items-center gap-1.5 bg-white/95 text-stone-800 text-xs font-semibold py-1.5 px-3 rounded-full shadow-lg border border-stone-200/80 transition-all duration-300 ${
          hovered ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2 pointer-events-none"
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse"></span>
        <span>¿Dudas? Chatea con Liliana</span>
      </div>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative group bg-[#25D366] hover:bg-[#20ba59] text-white p-3.5 sm:p-4 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center"
        aria-label="Contactar por WhatsApp"
      >
        {/* Onda de pulsación sutil */}
        <span className="absolute -inset-1 rounded-full bg-[#25D366] opacity-30 animate-ping pointer-events-none"></span>

        <MessageCircle size={26} className="relative z-10 transition-transform duration-300 group-hover:rotate-12" />
      </a>
    </div>
  );
}
