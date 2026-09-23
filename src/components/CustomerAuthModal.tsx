"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCountry, CountryCode } from "@/context/CountryContext";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { X, Sparkles, Gift, Check, ShieldCheck } from "lucide-react";

export default function CustomerAuthModal() {
  const { 
    authModalOpen, 
    closeAuthModal, 
    authModalTab, 
    openAuthModal, 
    refreshProfile 
  } = useAuth();

  const { country, setCountry } = useCountry();
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>("GT");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (country) {
      setSelectedCountry(country);
    }
  }, [country, authModalOpen]);

  if (!authModalOpen) return null;

  const isRegister = authModalTab === "register";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      if (!auth) {
        throw new Error("El servicio de autenticación no está disponible en este momento.");
      }

      if (isRegister) {
        // Register new customer
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        if (name.trim()) {
          await updateProfile(userCred.user, { displayName: name.trim() });
        }

        // Create user document with 50 points and 15% coupon for customers, no coupon or points for admin
        if (db) {
          const isPotentialAdmin = email.toLowerCase().includes("admin") || email.toLowerCase().includes("liliana");
          await setDoc(doc(db, "users", userCred.user.uid), {
            uid: userCred.user.uid,
            name: name.trim() || email.split("@")[0],
            email: email.trim(),
            role: isPotentialAdmin ? "admin" : "customer",
            country: selectedCountry,
            points: isPotentialAdmin ? 0 : 50, // 50 puntos para clientes, 0 para admin
            welcomeCoupon: isPotentialAdmin ? null : "BIENVENIDA15",
            firstPurchaseUsed: isPotentialAdmin ? true : false,
            createdAt: serverTimestamp()
          });
        }

        setCountry(selectedCountry);

        setSuccessMsg(
          (email.toLowerCase().includes("admin") || email.toLowerCase().includes("liliana"))
            ? "¡Cuenta de Administrador creada exitosamente!"
            : `¡Felicidades! Tu cuenta fue creada en ${selectedCountry === "GT" ? "Guatemala (Q)" : "El Salvador ($)"}. Recibiste tu cupón de 15% OFF y 50 Puntos.`
        );
        await refreshProfile();
        setTimeout(() => {
          closeAuthModal();
        }, 1500);
      } else {
        // Login existing user
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        if (db && userCred.user?.uid) {
          const uDoc = await getDoc(doc(db, "users", userCred.user.uid));
          if (uDoc.exists()) {
            const data = uDoc.data();
            if (data.country === "GT" || data.country === "SV") {
              setCountry(data.country);
            }
          }
        }
        await refreshProfile();
        closeAuthModal();
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("Correo o contraseña incorrectos.");
      } else if (err.code === "auth/email-already-in-use") {
        setError("Este correo ya tiene una cuenta creada. Por favor inicia sesión.");
      } else if (err.code === "auth/weak-password") {
        setError("La contraseña debe tener al menos 6 caracteres.");
      } else {
        setError(err.message || "Error al autenticar.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto transition-opacity duration-300 animate-in fade-in"
      onClick={closeAuthModal}
    >
      <div 
        className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-stone-200 relative my-8 transform transition-all duration-300 ease-out animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón Cerrar */}
        <button 
          onClick={closeAuthModal}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition"
        >
          <X size={18} />
        </button>

        {/* Banner de Beneficio Exclusivo */}
        <div className="bg-gradient-to-r from-[#FAF3EC] via-[#F4E3D5] to-[#FAF3EC] p-6 text-center border-b border-stone-200/80">
          <div className="inline-flex items-center gap-1.5 bg-[#C08261] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-2">
            <Gift size={13} /> Beneficio Exclusivo
          </div>
          <h3 className="text-xl font-serif font-bold text-gray-900 leading-tight">
            {isRegister ? "15% OFF en tu Primera Compra" : "Bienvenida a Liliana Salon"}
          </h3>
          <p className="text-xs text-stone-600 mt-1 max-w-xs mx-auto">
            {isRegister 
              ? "Crea tu cuenta gratis hoy y recibe un 15% de descuento más 50 Puntos de lealtad acumulables." 
              : "Inicia sesión para consultar tus puntos acumulados y cupones de descuento."}
          </p>
        </div>

        {/* Tabs Iniciar / Registrar */}
        <div className="flex border-b border-stone-100">
          <button
            type="button"
            onClick={() => {
              openAuthModal("login");
              setError("");
              setSuccessMsg("");
            }}
            className={`flex-1 py-3 text-xs uppercase tracking-wider font-semibold transition ${
              !isRegister 
                ? "border-b-2 border-black text-black" 
                : "text-stone-400 hover:text-stone-700"
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => {
              openAuthModal("register");
              setError("");
              setSuccessMsg("");
            }}
            className={`flex-1 py-3 text-xs uppercase tracking-wider font-semibold transition ${
              isRegister 
                ? "border-b-2 border-black text-black" 
                : "text-stone-400 hover:text-stone-700"
            }`}
          >
            Crear Cuenta (15% OFF)
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
          {error && (
            <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl leading-relaxed">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="p-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl leading-relaxed flex items-center gap-2">
              <Check size={16} className="flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {isRegister && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Tu Nombre
                </label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. María López"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  País de Envío & Moneda
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCountry("GT")}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2.5 ${
                      selectedCountry === "GT"
                        ? "border-[#C08261] bg-[#FAF3EC] text-black font-semibold ring-1 ring-[#C08261] shadow-xs"
                        : "border-stone-200 hover:border-stone-300 text-stone-600 bg-white"
                    }`}
                  >
                    <span className="text-xl">🇬🇹</span>
                    <div>
                      <span className="text-xs block font-bold leading-tight">Guatemala</span>
                      <span className="text-[10px] text-stone-500 block">Quetzales (Q)</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCountry("SV")}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2.5 ${
                      selectedCountry === "SV"
                        ? "border-[#C08261] bg-[#FAF3EC] text-black font-semibold ring-1 ring-[#C08261] shadow-xs"
                        : "border-stone-200 hover:border-stone-300 text-stone-600 bg-white"
                    }`}
                  >
                    <span className="text-xl">🇸🇻</span>
                    <div>
                      <span className="text-xs block font-bold leading-tight">El Salvador</span>
                      <span className="text-[10px] text-stone-500 block">Dólares ($)</span>
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Correo Electrónico
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Contraseña
            </label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          {isRegister && (
            <div className="bg-[#FAF9F7] p-3 rounded-xl border border-stone-200/60 text-[11px] text-stone-600 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-stone-800">
                <Sparkles size={13} className="text-[#C08261]" /> Incluye al instante:
              </div>
              <div>• Cupón <strong className="text-black font-semibold">BIENVENIDA15</strong> (15% en tu primer producto).</div>
              <div>• <strong className="text-black font-semibold">50 Puntos</strong> de regalo en tu saldo para canjear en el salón.</div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black hover:bg-stone-800 text-white py-3.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition disabled:opacity-50 mt-2"
          >
            {loading 
              ? "Procesando..." 
              : isRegister 
              ? "Registrarme y Obtener Beneficios" 
              : "Ingresar a mi Cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
}
