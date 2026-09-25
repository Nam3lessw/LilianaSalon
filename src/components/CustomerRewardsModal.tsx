"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCountry, CountryCode } from "@/context/CountryContext";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { 
  updateEmail, 
  updateProfile, 
  reauthenticateWithCredential, 
  EmailAuthProvider 
} from "firebase/auth";
import { 
  X, 
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
  Globe,
  User,
  Mail,
  Phone,
  KeyRound,
  AlertCircle,
  Save,
  CheckCircle
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
  wholesaleDiscount?: number;
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

  // Pestañas activas: "account" | "rewards" | "orders"
  const [activeTab, setActiveTab] = useState<"account" | "rewards" | "orders">("account");
  
  // Estados de edición del perfil ("Mi Cuenta")
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>("GT");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");

  // Estados de cupones y puntos
  const [copied, setCopied] = useState(false);

  // Estados de pedidos
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Inicializar campos del formulario con el perfil actual
  useEffect(() => {
    if (userProfile || user) {
      setName(userProfile?.name || user?.displayName || "");
      setEmail(user?.email || userProfile?.email || "");
      setPhone(userProfile?.phone || "");
      setSelectedCountry((userProfile?.country as CountryCode) || country || "GT");
    }
  }, [userProfile, user, customerDrawerOpen, country]);

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

        // Buscar por UID si no se encontraron o para complementar
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

  // Guardar cambios en el perfil del usuario
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    setSavingProfile(true);

    try {
      const cleanName = name.trim();
      const cleanEmail = email.trim();
      const cleanPhone = phone.trim();

      if (!cleanName) {
        throw new Error("Por favor ingresa tu nombre completo.");
      }
      if (!cleanEmail) {
        throw new Error("Por favor ingresa un correo electrónico válido.");
      }

      const emailChanged = cleanEmail.toLowerCase() !== (user.email || "").toLowerCase();

      // 1. Si el correo cambió, actualizar en Firebase Auth
      if (emailChanged) {
        try {
          if (requiresPassword && currentPassword) {
            const credential = EmailAuthProvider.credential(user.email!, currentPassword);
            await reauthenticateWithCredential(user, credential);
          }
          await updateEmail(user, cleanEmail);
          // Refrescar token para que las reglas de seguridad reconozcan el nuevo email
          await user.getIdToken(true);
          setRequiresPassword(false);
          setCurrentPassword("");
        } catch (authErr: any) {
          if (authErr.code === "auth/requires-recent-login") {
            setRequiresPassword(true);
            throw new Error("Por tu seguridad, ingresa tu contraseña actual para confirmar el cambio de correo.");
          } else if (authErr.code === "auth/email-already-in-use") {
            throw new Error("Este correo electrónico ya está registrado con otra cuenta.");
          } else if (authErr.code === "auth/invalid-email") {
            throw new Error("El formato del correo electrónico no es válido.");
          } else if (authErr.code === "auth/wrong-password" || authErr.code === "auth/invalid-credential") {
            throw new Error("La contraseña ingresada no es correcta.");
          }
          throw authErr;
        }
      }

      // 2. Actualizar displayName en Firebase Auth si cambió
      if (cleanName !== user.displayName) {
        await updateProfile(user, { displayName: cleanName });
      }

      // 3. Actualizar documento en Firestore
      if (db) {
        const updatePayload: Record<string, any> = {
          name: cleanName,
          phone: cleanPhone,
          country: selectedCountry
        };

        if (emailChanged) {
          updatePayload.email = cleanEmail;
        }

        await updateDoc(doc(db, "users", user.uid), updatePayload);
      }

      // 4. Actualizar preferencia de país en la app
      setCountry(selectedCountry);

      // 5. Recargar perfil
      await refreshProfile();

      setProfileSuccess("¡Tus datos y país han sido actualizados con éxito!");
      setTimeout(() => setProfileSuccess(null), 3500);
    } catch (err: any) {
      console.error("Error saving user profile:", err);
      setProfileError(err.message || "Ocurrió un error al guardar los cambios.");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto transition-opacity duration-300 animate-in fade-in"
      onClick={() => setCustomerDrawerOpen(false)}
    >
      <div 
        className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200 relative my-auto transform transition-all duration-300 ease-out animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera Fija del HUD */}
        <div className="bg-[#FAF3EC] p-4 sm:p-6 border-b border-stone-200/80 relative">
          <button 
            onClick={() => setCustomerDrawerOpen(false)}
            className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-stone-700 shadow-xs flex items-center justify-center transition"
            aria-label="Cerrar ventana"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3.5 pr-10">
            <div className="w-12 h-12 rounded-full bg-[#C08261] text-white flex items-center justify-center font-serif text-xl font-bold shadow-xs shrink-0">
              {(userProfile?.name || user.displayName || user.email || "C")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-serif font-bold text-gray-900 truncate">
                  {userProfile?.name || user.displayName || (isAdmin ? "Administrador" : "Cliente")}
                </h3>
                {isAdmin && (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-300 shrink-0">
                    <Lock size={10} /> Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 truncate">{user.email}</p>
            </div>
          </div>

          {/* Enlace directo a Panel Admin si aplica */}
          {isAdmin && (
            <div className="mt-3 pt-3 border-t border-stone-200/70 flex items-center justify-between">
              <span className="text-xs text-stone-600 font-medium">Acceso Administrativo:</span>
              <Link 
                href="/admin" 
                onClick={() => setCustomerDrawerOpen(false)}
                className="bg-black text-white px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider hover:bg-stone-800 transition flex items-center gap-1.5 shadow-xs"
              >
                Panel Admin <ExternalLink size={12} />
              </Link>
            </div>
          )}

          {/* Barra de Pestañas Segmentada y Desplazable */}
          <div className="flex items-center gap-1.5 mt-4 pt-2 border-t border-stone-200/60 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab("account")}
              className={`flex-1 min-w-[110px] py-2 px-3 text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 ${
                activeTab === "account"
                  ? "bg-white text-stone-900 shadow-xs border border-stone-200"
                  : "text-stone-500 hover:text-stone-900 hover:bg-white/40"
              }`}
            >
              <User size={14} className={activeTab === "account" ? "text-[#C08261]" : "text-stone-400"} /> 
              Mi Cuenta
            </button>

            {!isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab("rewards")}
                className={`flex-1 min-w-[110px] py-2 px-3 text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 ${
                  activeTab === "rewards"
                    ? "bg-white text-stone-900 shadow-xs border border-stone-200"
                    : "text-stone-500 hover:text-stone-900 hover:bg-white/40"
                }`}
              >
                <Award size={14} className={activeTab === "rewards" ? "text-[#C08261]" : "text-stone-400"} /> 
                Mis Puntos
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab("orders")}
              className={`flex-1 min-w-[110px] py-2 px-3 text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 ${
                activeTab === "orders"
                  ? "bg-white text-stone-900 shadow-xs border border-stone-200"
                  : "text-stone-500 hover:text-stone-900 hover:bg-white/40"
              }`}
            >
              <ShoppingBag size={14} className={activeTab === "orders" ? "text-[#C08261]" : "text-stone-400"} /> 
              Mis Pedidos
              {orders.length > 0 && (
                <span className="bg-[#C08261] text-white text-[10px] px-1.5 py-0.2 rounded-full font-sans font-semibold">
                  {orders.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Contenido Principal Desplazable del HUD */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5">
          
          {/* ============================================================== */}
          {/* TAB 1: MI CUENTA (Edición de Nombre, Correo, Teléfono y País) */}
          {/* ============================================================== */}
          {activeTab === "account" && (
            <div className="space-y-5">
              <div className="border-b border-stone-100 pb-2">
                <h4 className="text-base font-serif font-bold text-gray-900">
                  Información Personal & Preferencias
                </h4>
                <p className="text-xs text-stone-500 mt-0.5">
                  Actualiza tus datos de contacto y país para agilizar tus compras y envíos.
                </p>
              </div>

              {profileSuccess && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {profileError && (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle size={16} className="text-red-600 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                {/* Campo: Nombre Completo */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                    <User size={13} className="text-[#C08261]" /> Nombre Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre completo"
                    className="w-full text-xs p-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:border-[#C08261] focus:ring-1 focus:ring-[#C08261] transition"
                  />
                </div>

                {/* Campo: Correo Electrónico */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                    <Mail size={13} className="text-[#C08261]" /> Correo Electrónico
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tucorreo@ejemplo.com"
                    className="w-full text-xs p-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:border-[#C08261] focus:ring-1 focus:ring-[#C08261] transition"
                  />
                  <span className="text-[10px] text-stone-400 block">
                    Usado para enviar confirmaciones y recibos digitales oficiales.
                  </span>
                </div>

                {/* Si requiere reautenticación por contraseña */}
                {requiresPassword && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-2 animate-in fade-in">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                      <KeyRound size={14} /> Confirmar Contraseña Actual
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Por razones de seguridad, ingresa tu contraseña actual para autorizar el cambio de correo electrónico.
                    </p>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Contraseña actual"
                      className="w-full text-xs p-2.5 rounded-xl border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                )}

                {/* Campo: Teléfono / WhatsApp */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                    <Phone size={13} className="text-[#C08261]" /> Teléfono / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej: +502 5555-5555 o +503 7777-7777"
                    className="w-full text-xs p-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:border-[#C08261] focus:ring-1 focus:ring-[#C08261] transition"
                  />
                  <span className="text-[10px] text-stone-400 block">
                    Se utilizará automáticamente para coordinar la entrega de tus pedidos por WhatsApp.
                  </span>
                </div>

                {/* Campo: País de Entrega & Moneda */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                      <Globe size={13} className="text-[#C08261]" /> País de Entrega & Moneda
                    </label>
                    <span className="text-[10px] text-stone-400 font-medium">
                      {selectedCountry === "GT" ? "Precios en Quetzales (Q)" : "Precios en Dólares ($)"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedCountry("GT")}
                      className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                        selectedCountry === "GT"
                          ? "bg-amber-50/60 border-[#C08261] ring-1 ring-[#C08261] shadow-2xs"
                          : "bg-stone-50 border-stone-200 hover:bg-stone-100/60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xl">🇬🇹</span>
                        {selectedCountry === "GT" && (
                          <span className="bg-[#C08261] text-white p-0.5 rounded-full">
                            <Check size={12} />
                          </span>
                        )}
                      </div>
                      <div className="mt-2">
                        <span className="font-bold text-xs text-gray-900 block">Guatemala</span>
                        <span className="text-[10px] text-stone-500">Moneda Quetzales (Q)</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedCountry("SV")}
                      className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                        selectedCountry === "SV"
                          ? "bg-amber-50/60 border-[#C08261] ring-1 ring-[#C08261] shadow-2xs"
                          : "bg-stone-50 border-stone-200 hover:bg-stone-100/60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xl">🇸🇻</span>
                        {selectedCountry === "SV" && (
                          <span className="bg-[#C08261] text-white p-0.5 rounded-full">
                            <Check size={12} />
                          </span>
                        )}
                      </div>
                      <div className="mt-2">
                        <span className="font-bold text-xs text-gray-900 block">El Salvador</span>
                        <span className="text-[10px] text-stone-500">Moneda Dólares ($)</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Botón Guardar Cambios */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="w-full bg-black hover:bg-stone-800 text-white font-semibold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition disabled:opacity-50"
                  >
                    {savingProfile ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Guardando Cambios...
                      </>
                    ) : (
                      <>
                        <Save size={14} /> Guardar Cambios
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: MIS PUNTOS & CUPÓN (SOLO CLIENTES)                     */}
          {/* ============================================================== */}
          {!isAdmin && activeTab === "rewards" && (
            <div className="space-y-5">
              {/* Tarjeta de Puntos Acumulados */}
              <div className="bg-gradient-to-br from-[#1C1A17] to-[#2E2A25] text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <Coins size={110} />
                </div>

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-[0.25em] text-[#E0A98B] font-semibold flex items-center gap-1.5">
                      <Award size={14} /> Club Liliana Salon
                    </span>
                    <span className="text-xs bg-white/10 px-2.5 py-0.5 rounded-full text-stone-300">
                      Puntos VIP
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-5xl font-serif font-bold text-white tracking-tight">
                      {points}
                    </span>
                    <span className="text-sm font-light text-stone-300">PUNTOS VIP</span>
                  </div>

                  <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-2xl border border-white/10 text-xs text-stone-200 space-y-2">
                    <div className="font-semibold text-white flex items-center gap-1.5">
                      <Sparkles size={13} className="text-[#E0A98B]" /> Sistema de Recompensas
                    </div>
                    <p className="text-[11px] text-stone-300 leading-relaxed">
                      • <strong className="text-white">Q10 gastados = 1 punto</strong> ($1.25 = 1 punto) en todas tus compras.
                    </p>
                    <p className="text-[11px] text-stone-300 leading-relaxed">
                      • Puedes canjearlos al completar tu pedido (mínimo aplicable: <strong className="text-[#E0A98B]">250 puntos</strong>).
                    </p>
                  </div>
                </div>
              </div>

              {/* Cupón de Bienvenida 15% OFF */}
              <div className="border border-stone-200 rounded-3xl p-5 bg-[#FAF9F7] space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      userProfile?.firstPurchaseUsed
                        ? "bg-stone-200 text-stone-600"
                        : "bg-orange-100 text-[#A06C52]"
                    }`}>
                      {userProfile?.firstPurchaseUsed ? "Cupón Ya Utilizado" : "Cupón de Primera Compra"}
                    </span>
                    <h4 className="text-base font-serif font-bold text-gray-900 mt-2">
                      15% de Descuento
                    </h4>
                    <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                      {userProfile?.firstPurchaseUsed
                        ? "Ya utilizaste tu descuento de bienvenida en tu primer pedido. ¡Ahora sigues acumulando puntos VIP en cada compra!"
                        : "Aplica de forma automática en tu bolsa al producto de mayor valor o indícalo al ordenar por WhatsApp."}
                    </p>
                  </div>
                </div>

                {!userProfile?.firstPurchaseUsed && (
                  <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-dashed border-stone-300">
                    <div>
                      <span className="text-[10px] text-stone-400 uppercase tracking-widest block font-medium">Código oficial</span>
                      <span className="text-sm font-mono font-bold text-black tracking-widest">{couponCode}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyCoupon}
                      className="bg-black hover:bg-stone-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
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

          {/* ============================================================== */}
          {/* TAB 3: MIS PEDIDOS (Historial, Estado y Recibos Digitales)      */}
          {/* ============================================================== */}
          {activeTab === "orders" && (
            <div className="space-y-4">
              <div className="border-b border-stone-100 pb-2">
                <h4 className="text-base font-serif font-bold text-gray-900">
                  Historial de Pedidos & Recibos
                </h4>
                <p className="text-xs text-stone-500 mt-0.5">
                  Consulta el estado de tus compras y descarga tus recibos oficiales.
                </p>
              </div>

              {loadingOrders ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2 text-stone-500 text-xs">
                  <Loader2 size={24} className="animate-spin text-[#C08261]" />
                  <span>Cargando tus pedidos...</span>
                </div>
              ) : orders.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[#FAF3EC] text-[#A8623D] flex items-center justify-center mx-auto">
                    <ShoppingBag size={22} />
                  </div>
                  <h4 className="font-serif text-base font-bold text-gray-900">Aún no tienes compras registradas</h4>
                  <p className="text-xs text-stone-500 max-w-xs mx-auto">
                    Cuando realices un pedido desde el carrito o WhatsApp, aquí podrás ver tu recibo digital oficial y los puntos acumulados.
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

                        {/* Desglose de Productos */}
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
                                    Unitario: {symbol}{item.unitPrice.toFixed(2)}
                                  </span>
                                </div>
                                <span className="font-bold text-stone-800 whitespace-nowrap">
                                  {symbol}{item.totalPrice.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Desglose Financiero */}
                        <div className="bg-white p-3 rounded-xl border border-stone-200 text-xs space-y-1">
                          <div className="flex justify-between text-stone-500">
                            <span>Subtotal:</span>
                            <span>{symbol}{o.subtotal?.toFixed(2)}</span>
                          </div>

                          {o.wholesaleDiscount && o.wholesaleDiscount > 0 && (
                            <div className="flex justify-between text-emerald-700 font-semibold">
                              <span>Descuento Mayoreo / Docena (10%):</span>
                              <span>-{symbol}{o.wholesaleDiscount.toFixed(2)}</span>
                            </div>
                          )}

                          {o.discount > 0 && (
                            <div className="flex justify-between text-emerald-700 font-semibold">
                              <span>Descuento Cupón (15%):</span>
                              <span>-{symbol}{o.discount.toFixed(2)}</span>
                            </div>
                          )}

                          <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-stone-100">
                            <span>Total del Pedido:</span>
                            <span className="text-[#A8623D]">{symbol}{o.total?.toFixed(2)} {o.currency}</span>
                          </div>

                          {!isAdmin && o.pointsEarned > 0 && (
                            <div className="flex justify-between text-[11px] text-stone-500 pt-0.5">
                              <span className="flex items-center gap-1">
                                <Coins size={11} className="text-[#C08261]" /> Puntos obtenidos:
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

        </div>

        {/* Pie Fijo del Modal con Acción de Cerrar Sesión */}
        <div className="p-4 bg-stone-50 border-t border-stone-200/80 flex items-center justify-between">
          <div className="text-[11px] text-stone-500 truncate max-w-[200px] sm:max-w-xs">
            Conectado como <strong className="text-stone-800">{user.email}</strong>
          </div>
          <button
            type="button"
            onClick={logout}
            className="px-3.5 py-1.5 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-600 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
          >
            <LogOut size={13} /> Cerrar Sesión
          </button>
        </div>

      </div>
    </div>
  );
}
