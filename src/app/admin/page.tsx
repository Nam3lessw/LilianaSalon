"use client";
import { useState, useEffect, useRef } from "react";
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  updateDoc, 
  serverTimestamp, 
  getDoc, 
  setDoc 
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { 
  Trash2, 
  Edit2, 
  LogOut, 
  Plus, 
  Image as ImageIcon, 
  ArrowLeft, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  Package,
  Award,
  Users,
  Settings,
  Coins,
  Sparkles,
  Gift,
  ArrowRightLeft
} from "lucide-react";
import Link from "next/link";
import { convertGTQtoUSD, convertUSDtoGTQ, roundToCommercialPrice, DEFAULT_EXCHANGE_RATE } from "@/lib/currency";

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  priceUSD?: number | null;
  oldPrice: number | null;
  oldPriceUSD?: number | null;
  tag: string;
  image: string;
  stock: number;
  volume?: string;
  description?: string;
  createdAt?: any;
}

export interface LoyaltySettings {
  welcomePoints: number;
  welcomeDiscountPercent: number;
  pointsPerQuetzal: number;
  pointsRedemptionRate: number; // e.g. 10 pts = Q1
  pointsForFreeProduct: number; // e.g. 500 pts
}

export interface CustomerUser {
  id: string;
  name: string;
  email: string;
  role: string;
  points: number;
  welcomeCoupon?: string;
  createdAt?: any;
}

export default function AdminDashboard() {
  const router = useRouter();

  // Navigation tab in Admin
  const [activeTab, setActiveTab] = useState<"products" | "loyalty">("products");

  // Auth and loading states
  const [authChecking, setAuthChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Keratech");
  const [customCategory, setCustomCategory] = useState("");
  const [price, setPrice] = useState("");
  const [oldPrice, setOldPrice] = useState("");
  const [tag, setTag] = useState("");
  const [image, setImage] = useState("");
  const [stock, setStock] = useState("10");
  const [volume, setVolume] = useState("");
  const [description, setDescription] = useState("");
  const [priceUSD, setPriceUSD] = useState("");
  const [oldPriceUSD, setOldPriceUSD] = useState("");
  const [autoConvert, setAutoConvert] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  // File upload preview
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePriceGTQChange = (val: string) => {
    setPrice(val);
    if (autoConvert && val) {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        const usd = convertGTQtoUSD(num);
        setPriceUSD(usd.toFixed(2));
      }
    } else if (!val) {
      setPriceUSD("");
    }
  };

  const handlePriceUSDChange = (val: string) => {
    setPriceUSD(val);
    if (autoConvert && val) {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        const gtq = convertUSDtoGTQ(num);
        setPrice(gtq.toFixed(2));
      }
    } else if (!val) {
      setPrice("");
    }
  };

  const handleOldPriceGTQChange = (val: string) => {
    setOldPrice(val);
    if (autoConvert && val) {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        const usd = convertGTQtoUSD(num);
        setOldPriceUSD(usd.toFixed(2));
      }
    } else if (!val) {
      setOldPriceUSD("");
    }
  };

  const handleOldPriceUSDChange = (val: string) => {
    setOldPriceUSD(val);
    if (autoConvert && val) {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        const gtq = convertUSDtoGTQ(num);
        setOldPrice(gtq.toFixed(2));
      }
    } else if (!val) {
      setOldPrice("");
    }
  };

  // Loyalty Settings state
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings>({
    welcomePoints: 50,
    welcomeDiscountPercent: 15,
    pointsPerQuetzal: 1, // 1 punto por cada Q10
    pointsRedemptionRate: 10, // 10 puntos = Q1 descuento (100 pts = Q10)
    pointsForFreeProduct: 500
  });
  const [customers, setCustomers] = useState<CustomerUser[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);

  // Persistent Auth Check (No expulsa al usuario al recargar)
  useEffect(() => {
    const hasAdminSession = 
      typeof window !== "undefined" && 
      (localStorage.getItem("admin_session") === "true" || sessionStorage.getItem("mockAuth") === "true");

    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        if (currentUser) {
          localStorage.setItem("admin_session", "true");
          setAuthChecking(false);
          fetchProducts();
          fetchLoyaltyData();
        } else if (hasAdminSession) {
          // Mantener abierta la sesión del admin guardada en localStorage
          setAuthChecking(false);
          fetchProducts();
          fetchLoyaltyData();
        } else {
          router.push("/admin/login");
        }
      });
      return () => unsubscribe();
    } else {
      if (hasAdminSession) {
        setAuthChecking(false);
        fetchProducts();
      } else {
        router.push("/admin/login");
      }
    }
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      if (db) {
        const querySnapshot = await getDocs(collection(db, "products"));
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setProducts(data);
      } else {
        const local = localStorage.getItem("mockProducts");
        if (local) setProducts(JSON.parse(local));
      }
    } catch (e: any) {
      console.error("Error fetching products", e);
      setStatusMessage({ type: "error", text: "Error al cargar productos: " + e.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchLoyaltyData = async () => {
    if (!db) return;
    try {
      // 1. Cargar configuración de fidelización
      const settingsSnap = await getDoc(doc(db, "settings", "loyalty"));
      if (settingsSnap.exists()) {
        setLoyaltySettings(settingsSnap.data() as LoyaltySettings);
      }

      // 2. Cargar clientes registrados
      const usersSnap = await getDocs(collection(db, "users"));
      const userList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerUser));
      setCustomers(userList.filter(u => u.role !== "admin"));
    } catch (err) {
      console.error("Error fetching loyalty data", err);
    }
  };

  const handleSaveLoyaltySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      if (db) {
        await setDoc(doc(db, "settings", "loyalty"), {
          ...loyaltySettings,
          updatedAt: serverTimestamp()
        });
        setStatusMessage({ type: "success", text: "¡Parámetros de puntos actualizados exitosamente en Firebase!" });
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: "error", text: "Error al guardar configuración: " + err.message });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAdjustPoints = async (customerId: string, delta: number) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer || !db) return;
    const newPoints = Math.max(0, (customer.points || 0) + delta);

    try {
      await updateDoc(doc(db, "users", customerId), {
        points: newPoints,
        updatedAt: serverTimestamp()
      });
      setCustomers(customers.map(c => c.id === customerId ? { ...c, points: newPoints } : c));
      setStatusMessage({ 
        type: "success", 
        text: `Puntos actualizados para ${customer.name || customer.email}: ${newPoints} pts.` 
      });
    } catch (err: any) {
      console.error("Error updating points:", err);
      setStatusMessage({ type: "error", text: "Error al actualizar puntos: " + err.message });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        setImage(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImageIfNeeded = async (): Promise<string> => {
    if (imageFile && storage) {
      try {
        const storageRef = ref(storage, `products/${Date.now()}_${imageFile.name}`);
        const snapshot = await uploadBytes(storageRef, imageFile);
        const downloadUrl = await getDownloadURL(snapshot.ref);
        return downloadUrl;
      } catch (err) {
        console.warn("Storage fallback to base64", err);
        return imagePreview || image;
      }
    }
    return image || imagePreview || "https://images.unsplash.com/photo-1599305090598-fe179d501227?q=80&w=600&auto=format&fit=crop";
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      const finalCategory = category === "Otra" ? (customCategory.trim() || "General") : category;
      const finalImageUrl = await uploadImageIfNeeded();

      const parsedPriceQ = parseFloat(price) || 0;
      const parsedPriceUSD = priceUSD ? parseFloat(priceUSD) : convertGTQtoUSD(parsedPriceQ);
      const parsedOldPriceQ = oldPrice ? parseFloat(oldPrice) : null;
      const parsedOldPriceUSD = oldPriceUSD ? parseFloat(oldPriceUSD) : (parsedOldPriceQ ? convertGTQtoUSD(parsedOldPriceQ) : null);

      const productData = {
        name: name.trim(),
        brand: finalCategory,
        category: finalCategory,
        price: parsedPriceQ,
        priceUSD: parsedPriceUSD,
        oldPrice: parsedOldPriceQ,
        oldPriceUSD: parsedOldPriceUSD,
        tag: tag.trim(),
        image: finalImageUrl,
        stock: parseInt(stock) || 0,
        volume: volume.trim() || "",
        description: description.trim() || "",
        updatedAt: serverTimestamp()
      };

      const withTimeout = (promise: Promise<any>, ms = 12000) => {
        return Promise.race([
          promise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Tiempo de espera agotado al contactar con Firebase.")), ms)
          )
        ]);
      };

      if (db) {
        if (editingId) {
          await withTimeout(updateDoc(doc(db, "products", editingId), productData));
          setStatusMessage({ type: "success", text: "¡Producto actualizado exitosamente en Firebase!" });
        } else {
          await withTimeout(addDoc(collection(db, "products"), {
            ...productData,
            createdAt: serverTimestamp()
          }));
          setStatusMessage({ type: "success", text: "¡Producto guardado exitosamente en Firebase!" });
        }
      } else {
        const updated = editingId 
          ? products.map(p => p.id === editingId ? { ...productData, id: editingId } : p)
          : [...products, { ...productData, id: Date.now().toString() }];
        localStorage.setItem("mockProducts", JSON.stringify(updated));
        setProducts(updated as any);
        setStatusMessage({ type: "success", text: "Producto guardado (Modo local)." });
      }

      resetForm();
      fetchProducts();
    } catch (e: any) {
      console.error("Error saving product:", e);
      setStatusMessage({ type: "error", text: "Error al guardar: " + e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este producto?")) return;
    try {
      if (db) {
        await deleteDoc(doc(db, "products", id));
        setStatusMessage({ type: "success", text: "Producto eliminado de Firebase." });
      } else {
        const updated = products.filter(p => p.id !== id);
        localStorage.setItem("mockProducts", JSON.stringify(updated));
        setProducts(updated);
      }
      fetchProducts();
    } catch (e: any) {
      console.error("Error deleting", e);
      setStatusMessage({ type: "error", text: "Error al eliminar: " + e.message });
    }
  };

  const handleEdit = (p: Product) => {
    setEditingId(p.id);
    setName(p.name);
    if (["Keratech", "IvoGa", "Cuidado Facial", "Accesorios", "Perfumes"].includes(p.brand || p.category)) {
      setCategory(p.brand || p.category);
      setCustomCategory("");
    } else {
      setCategory("Otra");
      setCustomCategory(p.brand || p.category || "");
    }
    setPrice(p.price.toString());
    setPriceUSD(p.priceUSD ? p.priceUSD.toString() : (p.price ? convertGTQtoUSD(p.price).toString() : ""));
    setOldPrice(p.oldPrice ? p.oldPrice.toString() : "");
    setOldPriceUSD(p.oldPriceUSD ? p.oldPriceUSD.toString() : (p.oldPrice ? convertGTQtoUSD(p.oldPrice).toString() : ""));
    setTag(p.tag || "");
    setImage(p.image);
    setImagePreview(p.image);
    setStock(p.stock.toString());
    setVolume(p.volume || "");
    setDescription(p.description || "");
    setActiveTab("products");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setPrice("");
    setPriceUSD("");
    setOldPrice("");
    setOldPriceUSD("");
    setTag("");
    setImage("");
    setImagePreview("");
    setImageFile(null);
    setStock("10");
    setVolume("");
    setDescription("");
    setCustomCategory("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
    }
    localStorage.removeItem("admin_session");
    sessionStorage.removeItem("mockAuth");
    router.push("/admin/login");
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#FBF9F7] flex flex-col items-center justify-center">
        <RefreshCw className="animate-spin text-[#C08261] mb-3" size={32} />
        <p className="text-sm font-serif text-stone-700">Verificando sesión administrativa...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF9F7] text-gray-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-500 hover:text-black flex items-center gap-1.5 text-xs uppercase tracking-wider transition">
              <ArrowLeft size={16} /> Ver Tienda
            </Link>
            <span className="text-gray-300">|</span>
            <div>
              <span className="text-xs uppercase tracking-[0.25em] text-[#C08261] font-semibold block">Liliana Salon</span>
              <h1 className="text-xl font-serif font-medium tracking-wide">Panel Administrativo</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                fetchProducts();
                fetchLoyaltyData();
              }}
              className="text-xs text-gray-600 hover:text-black flex items-center gap-1 p-2 rounded-lg hover:bg-stone-100 transition"
              title="Refrescar datos"
            >
              <RefreshCw size={15} />
            </button>
            <button 
              onClick={handleLogout} 
              className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-stone-600 hover:text-red-600 transition px-3 py-2 rounded-lg hover:bg-red-50"
            >
              <LogOut size={15} /> Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Pestañas de Navegación del Admin */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-8 border-t border-stone-100 text-xs font-semibold uppercase tracking-wider">
          <button
            onClick={() => setActiveTab("products")}
            className={`py-3 flex items-center gap-2 border-b-2 transition ${
              activeTab === "products" 
                ? "border-black text-black font-bold" 
                : "border-transparent text-stone-400 hover:text-stone-700"
            }`}
          >
            <Package size={15} /> Productos & Inventario ({products.length})
          </button>
          <button
            onClick={() => setActiveTab("loyalty")}
            className={`py-3 flex items-center gap-2 border-b-2 transition ${
              activeTab === "loyalty" 
                ? "border-black text-black font-bold" 
                : "border-transparent text-stone-400 hover:text-stone-700"
            }`}
          >
            <Award size={15} /> Puntos & Fidelización ({customers.length} Clientes)
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Status Alerts */}
        {statusMessage && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm ${
            statusMessage.type === "success" 
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
              : "bg-red-50 text-red-800 border border-red-200"
          }`}>
            {statusMessage.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* TAB 1: PRODUCTOS E INVENTARIO */}
        {activeTab === "products" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Formulario de Producto */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-200 lg:col-span-5">
              <div className="flex justify-between items-center mb-6 border-b border-stone-100 pb-4">
                <div>
                  <h2 className="text-lg font-serif font-medium">
                    {editingId ? "Editar Producto" : "Agregar Nuevo Producto"}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {editingId ? "Modifica los datos del producto" : "Completa la información para publicarlo en la tienda"}
                  </p>
                </div>
                {editingId && (
                  <button 
                    type="button" 
                    onClick={resetForm} 
                    className="text-xs text-stone-500 hover:text-black underline"
                  >
                    Nuevo
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmitProduct} className="space-y-5">
                {/* Nombre */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Nombre del Producto *
                  </label>
                  <input 
                    required 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black" 
                    placeholder="Ej. Kera Touch Shampoo Keratina" 
                  />
                </div>

                {/* Categoría / Marca */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Categoría / Marca *
                    </label>
                    <select 
                      value={category} 
                      onChange={e => setCategory(e.target.value)} 
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-black"
                    >
                      <option value="Keratech">Keratech</option>
                      <option value="IvoGa">IvoGa</option>
                      <option value="Cuidado Facial">Cuidado Facial</option>
                      <option value="Accesorios">Accesorios</option>
                      <option value="Perfumes">Perfumes</option>
                      <option value="Otra">Otra (personalizada)...</option>
                    </select>
                  </div>

                  {category === "Otra" ? (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                        Nombre de Categoría *
                      </label>
                      <input 
                        type="text" 
                        value={customCategory} 
                        onChange={e => setCustomCategory(e.target.value)} 
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black" 
                        placeholder="Ej. Tratamientos" 
                        required
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                        Stock (Unidades) *
                      </label>
                      <input 
                        required 
                        type="number" 
                        min="0"
                        value={stock} 
                        onChange={e => setStock(e.target.value)} 
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black" 
                      />
                    </div>
                  )}
                </div>

                {category === "Otra" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Stock (Unidades Disponibles) *
                    </label>
                    <input 
                      required 
                      type="number" 
                      min="0"
                      value={stock} 
                      onChange={e => setStock(e.target.value)} 
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black" 
                    />
                  </div>
                )}

                {/* Precios Multidivisa (Guatemala 🇬🇹 & El Salvador 🇸🇻) */}
                <div className="bg-[#FAF9F7] p-4 rounded-xl border border-stone-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                      <Coins size={14} className="text-[#C08261]" /> Precios (GT 🇬🇹 & SV 🇸🇻)
                    </span>
                    <button
                      type="button"
                      onClick={() => setAutoConvert(!autoConvert)}
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 transition ${
                        autoConvert ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-600"
                      }`}
                      title="Activa o desactiva el cálculo automático con redondeo comercial"
                    >
                      <ArrowRightLeft size={10} /> {autoConvert ? "Conversión Auto ON" : "Manual"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
                        🇬🇹 Precio Venta (Q) *
                      </label>
                      <input 
                        required 
                        type="number" 
                        step="0.05" 
                        min="0"
                        value={price} 
                        onChange={e => handlePriceGTQChange(e.target.value)} 
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-black font-semibold" 
                        placeholder="Q 180.00" 
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
                        🇸🇻 Precio Venta ($ USD) *
                      </label>
                      <input 
                        required 
                        type="number" 
                        step="0.05" 
                        min="0"
                        value={priceUSD} 
                        onChange={e => handlePriceUSDChange(e.target.value)} 
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-black font-semibold" 
                        placeholder="$ 23.25" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-stone-200/60">
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                        🇬🇹 Precio Anterior (Oferta Q)
                      </label>
                      <input 
                        type="number" 
                        step="0.05" 
                        min="0"
                        value={oldPrice} 
                        onChange={e => handleOldPriceGTQChange(e.target.value)} 
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-black" 
                        placeholder="Opcional (Ej. 200)" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                        🇸🇻 Precio Anterior ($ USD)
                      </label>
                      <input 
                        type="number" 
                        step="0.05" 
                        min="0"
                        value={oldPriceUSD} 
                        onChange={e => handleOldPriceUSDChange(e.target.value)} 
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-black" 
                        placeholder="Opcional (Ej. 25.80)" 
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-stone-400">
                    💡 Redondeo comercial inteligente activo (terminaciones .00, .25, .50, .75, .80, .90). 1 USD ≈ Q7.78.
                  </p>
                </div>

                {/* Etiqueta distintiva */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Etiqueta Especial (Badge)
                  </label>
                  <div className="flex gap-2">
                    {["Oferta", "Nuevo", "Top Venta"].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setTag(tag === preset ? "" : preset)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                          tag === preset 
                            ? "bg-black text-white border-black" 
                            : "bg-stone-50 text-gray-600 border-gray-200 hover:border-gray-400"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                    <input 
                      type="text" 
                      value={tag} 
                      onChange={e => setTag(e.target.value)} 
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-black" 
                      placeholder="O escribe otra..." 
                    />
                  </div>
                </div>

                {/* Contenido / Volumen (ml, oz, etc.) - Opcional */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Contenido / Medida (ml / oz)</span>
                    <span className="text-[10px] text-gray-400 font-normal lowercase">(opcional)</span>
                  </label>
                  <div className="flex gap-2">
                    {["100ml", "250ml", "500ml", "1000ml"].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setVolume(volume === preset ? "" : preset)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border transition ${
                          volume === preset 
                            ? "bg-black text-white border-black" 
                            : "bg-stone-50 text-gray-600 border-gray-200 hover:border-gray-400"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                    <input 
                      type="text" 
                      value={volume} 
                      onChange={e => setVolume(e.target.value)} 
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-black" 
                      placeholder="Ej. 500ml, 16 oz..." 
                    />
                  </div>
                </div>

                {/* Descripción y Detalles del Producto */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Detalles & Beneficios del Producto</span>
                    <span className="text-[10px] text-gray-400 font-normal lowercase">(opcional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-black leading-relaxed"
                    placeholder="Escribe los beneficios, modo de uso, para qué tipo de cabello sirve, etc."
                  />
                </div>

                {/* Imagen del Producto: Subir archivo o URL */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Foto del Producto
                  </label>
                  <div className="space-y-3">
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange} 
                      className="block w-full text-xs text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-stone-100 file:text-stone-700 hover:file:bg-stone-200 cursor-pointer" 
                    />
                    <input 
                      type="url" 
                      value={image} 
                      onChange={e => {
                        setImage(e.target.value);
                        setImagePreview(e.target.value);
                      }} 
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-black" 
                      placeholder="O pega una URL: https://..." 
                    />
                    {imagePreview && (
                      <div className="mt-2 relative w-24 h-24 rounded-lg overflow-hidden border border-stone-200 bg-stone-50">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Botón Guardar */}
                <div className="pt-4 border-t border-stone-100 flex gap-3">
                  <button 
                    type="submit" 
                    disabled={saving}
                    className="flex-1 bg-black text-white py-3 rounded-lg text-xs font-semibold tracking-widest uppercase hover:bg-stone-800 transition disabled:opacity-50"
                  >
                    {saving ? "Guardando..." : editingId ? "Actualizar Producto" : "Publicar Producto"}
                  </button>
                  {editingId && (
                    <button 
                      type="button" 
                      onClick={resetForm} 
                      className="px-5 bg-stone-100 text-stone-700 py-3 rounded-lg text-xs font-semibold tracking-widest uppercase hover:bg-stone-200 transition"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Lista de Productos / Inventario */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-200 lg:col-span-7">
              <div className="flex justify-between items-center pb-6 border-b border-stone-100">
                <div>
                  <h2 className="text-lg font-serif font-medium">Inventario Actual</h2>
                  <p className="text-xs text-gray-500">
                    Productos registrados: {products.length}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Conectado a Firebase
                </span>
              </div>

              {loading ? (
                <div className="py-20 text-center text-sm text-gray-400">
                  <RefreshCw className="animate-spin mx-auto mb-3" size={24} />
                  Cargando productos...
                </div>
              ) : products.length === 0 ? (
                <div className="py-20 text-center text-stone-400 text-sm">
                  No hay productos registrados en la tienda.
                </div>
              ) : (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-stone-100 text-xs text-gray-400 uppercase tracking-wider">
                        <th className="py-3 px-2">Producto</th>
                        <th className="py-3 px-2">Categoría</th>
                        <th className="py-3 px-2">Precio</th>
                        <th className="py-3 px-2">Stock</th>
                        <th className="py-3 px-2 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {products.map((p) => {
                        const isOutOfStock = p.stock === 0;
                        const isLowStock = p.stock > 0 && p.stock <= 3;

                        return (
                          <tr key={p.id} className="hover:bg-stone-50/70 transition">
                            <td className="py-3 px-2 flex items-center gap-3">
                              <div className="w-12 h-12 rounded-lg bg-stone-100 overflow-hidden flex-shrink-0 border border-stone-200">
                                <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                              </div>
                              <div>
                                <div className="font-medium text-gray-900 leading-tight">
                                  {p.name} {p.volume && <span className="text-stone-500 font-normal text-xs">({p.volume})</span>}
                                </div>
                                {p.tag && (
                                  <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded">
                                    {p.tag}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-2 text-xs text-gray-600">
                              <span className="bg-stone-100 px-2 py-1 rounded text-stone-700">
                                {p.brand || p.category}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-xs">
                              <div className="font-semibold text-gray-900">
                                🇬🇹 Q{p.price?.toFixed(2)}
                              </div>
                              <div className="text-[11px] text-stone-500 font-medium">
                                🇸🇻 ${p.priceUSD ? p.priceUSD.toFixed(2) : convertGTQtoUSD(p.price).toFixed(2)} USD
                              </div>
                              {p.oldPrice && (
                                <div className="line-through text-gray-400 text-[10px]">
                                  Antes: Q{p.oldPrice.toFixed(2)}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-2 text-xs">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                isOutOfStock 
                                  ? "bg-red-100 text-red-700" 
                                  : isLowStock 
                                  ? "bg-amber-100 text-amber-800" 
                                  : "bg-emerald-100 text-emerald-800"
                              }`}>
                                {isOutOfStock ? "Agotado" : `${p.stock} un.`}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-right">
                              <div className="inline-flex gap-1">
                                <button 
                                  onClick={() => handleEdit(p)} 
                                  className="p-2 text-stone-500 hover:text-black hover:bg-stone-100 rounded-lg transition"
                                  title="Editar"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button 
                                  onClick={() => handleDelete(p.id)} 
                                  className="p-2 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                  title="Eliminar"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PUNTOS Y FIDELIZACIÓN */}
        {activeTab === "loyalty" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Configuración de Puntos */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-200 lg:col-span-5">
              <div className="flex items-center gap-2 mb-2">
                <Settings size={18} className="text-[#C08261]" />
                <h2 className="text-lg font-serif font-medium">Parámetros del Club de Puntos</h2>
              </div>
              <p className="text-xs text-gray-500 mb-6 border-b border-stone-100 pb-4">
                Define cómo ganan y canjean puntos tus clientes para fomentar compras repetidas.
              </p>

              <form onSubmit={handleSaveLoyaltySettings} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Puntos de Bienvenida (Regalo de Registro)</span>
                    <Gift size={14} className="text-[#C08261]" />
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={loyaltySettings.welcomePoints}
                    onChange={(e) => setLoyaltySettings({ ...loyaltySettings, welcomePoints: parseInt(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                  />
                  <p className="text-[11px] text-stone-400 mt-1">Puntos que recibe el cliente de inmediato al registrarse.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Descuento de Bienvenida (% Primer Compra)
                  </label>
                  <div className="relative">
                    <input
                      required
                      type="number"
                      min="0"
                      max="100"
                      value={loyaltySettings.welcomeDiscountPercent}
                      onChange={(e) => setLoyaltySettings({ ...loyaltySettings, welcomeDiscountPercent: parseInt(e.target.value) || 0 })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black pr-8"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-stone-400 font-bold">%</span>
                  </div>
                  <p className="text-[11px] text-stone-400 mt-1">Porcentaje de descuento para nuevos clientes (Cupón BIENVENIDA15).</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Equivalencia de Canje (Puntos por cada Q1 de descuento)
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={loyaltySettings.pointsRedemptionRate}
                    onChange={(e) => setLoyaltySettings({ ...loyaltySettings, pointsRedemptionRate: parseInt(e.target.value) || 1 })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                  />
                  <p className="text-[11px] text-stone-400 mt-1">Ej. Si pones 10: 100 puntos = Q10 de descuento en el salón.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Puntos para Producto o Tratamiento Gratis
                  </label>
                  <input
                    required
                    type="number"
                    min="10"
                    value={loyaltySettings.pointsForFreeProduct}
                    onChange={(e) => setLoyaltySettings({ ...loyaltySettings, pointsForFreeProduct: parseInt(e.target.value) || 500 })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                  />
                  <p className="text-[11px] text-stone-400 mt-1">Meta para premiar a clientes más fieles con un producto gratuito.</p>
                </div>

                <div className="pt-4 border-t border-stone-100">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="w-full bg-black text-white py-3 rounded-lg text-xs font-semibold tracking-widest uppercase hover:bg-stone-800 transition disabled:opacity-50"
                  >
                    {savingSettings ? "Guardando Configuración..." : "Guardar Parámetros de Puntos"}
                  </button>
                </div>
              </form>
            </div>

            {/* Lista de Clientes Registrados y Gestión Manual */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-200 lg:col-span-7">
              <div className="flex justify-between items-center pb-6 border-b border-stone-100">
                <div>
                  <h2 className="text-lg font-serif font-medium flex items-center gap-2">
                    <Users size={18} className="text-[#C08261]" /> Clientes Registrados ({customers.length})
                  </h2>
                  <p className="text-xs text-gray-500">
                    Gestiona los puntos acumulados de tus clientes por compras en el salón
                  </p>
                </div>
              </div>

              {customers.length === 0 ? (
                <div className="py-20 text-center text-stone-400 text-sm">
                  Aún no hay clientes registrados en la tienda.
                </div>
              ) : (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-stone-100 text-xs text-gray-400 uppercase tracking-wider">
                        <th className="py-3 px-2">Cliente</th>
                        <th className="py-3 px-2">Correo</th>
                        <th className="py-3 px-2 text-center">Puntos Actuales</th>
                        <th className="py-3 px-2 text-right">Sumar / Restar Puntos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {customers.map((c) => (
                        <tr key={c.id} className="hover:bg-stone-50/70 transition">
                          <td className="py-3 px-2 font-medium text-gray-900">
                            {c.name || "Cliente"}
                          </td>
                          <td className="py-3 px-2 text-xs text-stone-500">
                            {c.email}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 font-bold px-3 py-1 rounded-full text-xs">
                              <Coins size={12} className="text-[#C08261]" /> {c.points || 0} pts
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => handleAdjustPoints(c.id, -25)}
                                className="px-2 py-1 bg-stone-100 hover:bg-red-100 hover:text-red-700 text-stone-600 rounded text-xs font-bold transition"
                                title="Restar 25 puntos (canje)"
                              >
                                -25
                              </button>
                              <button
                                onClick={() => handleAdjustPoints(c.id, 25)}
                                className="px-2 py-1 bg-stone-100 hover:bg-emerald-100 hover:text-emerald-700 text-stone-600 rounded text-xs font-bold transition"
                                title="Sumar 25 puntos"
                              >
                                +25
                              </button>
                              <button
                                onClick={() => handleAdjustPoints(c.id, 50)}
                                className="px-2 py-1 bg-black hover:bg-stone-800 text-white rounded text-xs font-bold transition"
                                title="Sumar 50 puntos"
                              >
                                +50
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
