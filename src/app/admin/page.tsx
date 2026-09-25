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
  setDoc,
  increment 
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
  ArrowRightLeft,
  Receipt,
  FileText,
  Printer,
  Send,
  ShoppingBag,
  Clock,
  ExternalLink,
  RotateCcw,
  Check,
  AlertCircle,
  Phone,
  X,
  Search,
  ShieldCheck,
  Layers,
  ArrowUp,
  ArrowDown,
  Star
} from "lucide-react";
import Link from "next/link";
import { convertGTQtoUSD, convertUSDtoGTQ, roundToCommercialPrice, DEFAULT_EXCHANGE_RATE } from "@/lib/currency";
import { compressImage } from "@/lib/image-compress";

export interface CategoryItem {
  id: string;
  name: string;
  image?: string;
  order: number;
  featured: boolean;
  createdAt?: any;
}

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
  firstPurchaseUsed?: boolean;
  createdAt?: any;
}

export interface OrderReceipt {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  items: {
    productId: string;
    productName: string;
    brand: string;
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
  couponCode?: string | null;
  total: number;
  paymentMethod: string;
  pointsEarned: number;
  status?: "pendiente" | "completada" | "cancelada";
  notes?: string;
  createdAt: any;
}

const DEFAULT_CATEGORIES: Omit<CategoryItem, "id">[] = [
  { name: "Keratech", image: "https://images.unsplash.com/photo-1599305090598-fe179d501227?q=80&w=400&auto=format&fit=crop", order: 1, featured: true },
  { name: "IvoGa", image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=400&auto=format&fit=crop", order: 2, featured: true },
  { name: "Cuidado Facial", image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=400&auto=format&fit=crop", order: 3, featured: true },
  { name: "Accesorios", image: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?q=80&w=400&auto=format&fit=crop", order: 4, featured: true },
  { name: "Perfumes", image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?q=80&w=400&auto=format&fit=crop", order: 5, featured: true },
  { name: "Tratamientos", image: "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?q=80&w=400&auto=format&fit=crop", order: 6, featured: false }
];

export default function AdminDashboard() {
  const router = useRouter();

  // Navigation tab in Admin
  const [activeTab, setActiveTab] = useState<"products" | "orders" | "loyalty" | "categories">("products");

  // Categories & Priority Management state
  const [categories, setCategories] = useState<CategoryItem[]>(() =>
    DEFAULT_CATEGORIES.map((c, i) => ({ id: `default-${i}`, ...c }))
  );
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryImage, setCategoryImage] = useState("");
  const [categoryFeatured, setCategoryFeatured] = useState(true);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryImageFile, setCategoryImageFile] = useState<File | null>(null);
  const [categoryImagePreview, setCategoryImagePreview] = useState("");
  const categoryFileInputRef = useRef<HTMLInputElement>(null);

  // Orders & Receipts state
  const [orders, setOrders] = useState<OrderReceipt[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [manualCustomerName, setManualCustomerName] = useState<string>("");
  const [manualCustomerEmail, setManualCustomerEmail] = useState<string>("");
  const [manualCustomerPhone, setManualCustomerPhone] = useState<string>("");
  const [orderCurrency, setOrderCurrency] = useState<"GTQ" | "USD">("GTQ");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [orderQuantity, setOrderQuantity] = useState<number>(1);
  const [applyWelcomeCoupon, setApplyWelcomeCoupon] = useState<boolean>(true);
  const [paymentMethod, setPaymentMethod] = useState<string>("Transferencia / Depósito");
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [generatingReceipt, setGeneratingReceipt] = useState<boolean>(false);
  const [activeReceipt, setActiveReceipt] = useState<OrderReceipt | null>(null);
  const [receiptFilter, setReceiptFilter] = useState<string>("");

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
      const settingsSnap = await getDoc(doc(db, "settings", "loyalty"));
      if (settingsSnap.exists()) {
        setLoyaltySettings(settingsSnap.data() as LoyaltySettings);
      }

      const usersSnap = await getDocs(collection(db, "users"));
      const userList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerUser));
      setCustomers(userList.filter(u => u.role !== "admin"));
    } catch (err) {
      console.error("Error fetching loyalty data", err);
    }
  };

  const fetchOrders = async () => {
    if (!db) return;
    try {
      const ordersSnap = await getDocs(collection(db, "orders"));
      const list = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as OrderReceipt));
      list.sort((a, b) => {
        const timeA = a.createdAt?.seconds || (typeof a.createdAt === "string" ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.seconds || (typeof b.createdAt === "string" ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });
      setOrders(list);
    } catch (err) {
      console.error("Error fetching orders", err);
    }
  };

  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      let loaded = false;
      if (db) {
        try {
          const querySnapshot = await getDocs(collection(db, "categories"));
          if (!querySnapshot.empty) {
            const list = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as CategoryItem));
            list.sort((a, b) => (a.order || 0) - (b.order || 0));
            setCategories(list);
            loaded = true;
          }
        } catch (clientErr) {
          console.warn("Client Firestore getDocs for categories error, falling back to API:", clientErr);
        }
      }

      if (!loaded) {
        // Fallback a API route
        const res = await fetch("/api/categories");
        if (res.ok) {
          const data = await res.json();
          if (data.categories && data.categories.length > 0) {
            setCategories(data.categories);
            loaded = true;
          }
        }
      }
    } catch (e: any) {
      console.error("Error fetching categories", e);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleRestoreDefaultCategories = async () => {
    if (!confirm("¿Deseas sincronizar o inicializar las categorías base de la tienda?")) return;
    setLoadingCategories(true);
    setStatusMessage(null);

    try {
      const idToken = await auth?.currentUser?.getIdToken();
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { "Authorization": `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({ action: "seed" })
      });

      if (res.ok) {
        await fetchCategories();
        setStatusMessage({ type: "success", text: "¡Categorías base sincronizadas exitosamente!" });
        return;
      }

      // Si la API no respondió ok, intentar con cliente Firestore
      if (db) {
        const querySnapshot = await getDocs(collection(db, "categories"));
        const existingNames = new Set(querySnapshot.docs.map(d => d.data().name?.toLowerCase()));
        for (const cat of DEFAULT_CATEGORIES) {
          if (!existingNames.has(cat.name.toLowerCase())) {
            await addDoc(collection(db, "categories"), {
              ...cat,
              createdAt: serverTimestamp()
            });
          }
        }
        await fetchCategories();
        setStatusMessage({ type: "success", text: "¡Categorías sincronizadas exitosamente!" });
      }
    } catch (err: any) {
      console.error("Error restoring categories:", err);
      setStatusMessage({ type: "error", text: "Error al sincronizar categorías: " + err.message });
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleCategoryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const { dataUrl, blob } = await compressImage(file, 600, 0.82);
        setCategoryImageFile(new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" }));
        setCategoryImagePreview(dataUrl);
        setCategoryImage(dataUrl);
      } catch (err) {
        console.warn("Category image compression error, using raw:", err);
        setCategoryImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          setCategoryImagePreview(result);
          setCategoryImage(result);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const uploadCategoryImageIfNeeded = async (): Promise<string> => {
    if (categoryImageFile && storage) {
      try {
        const storageRef = ref(storage, `categories/${Date.now()}_${categoryImageFile.name}`);
        const uploadPromise = uploadBytes(storageRef, categoryImageFile).then(snapshot => getDownloadURL(snapshot.ref));
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Storage timeout")), 3500)
        );
        return await Promise.race([uploadPromise, timeoutPromise]);
      } catch (err) {
        console.warn("Category storage upload skipped or timed out, using optimized image:", err);
        return categoryImagePreview || categoryImage;
      }
    }
    return categoryImage || categoryImagePreview || "https://images.unsplash.com/photo-1599305090598-fe179d501227?q=80&w=400&auto=format&fit=crop";
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      setStatusMessage({ type: "error", text: "Por favor ingresa un nombre para la categoría." });
      return;
    }

    setSavingCategory(true);
    setStatusMessage(null);

    try {
      const finalImg = await uploadCategoryImageIfNeeded();
      const cleanName = categoryName.trim();

      if (db) {
        if (editingCategoryId) {
          await updateDoc(doc(db, "categories", editingCategoryId), {
            name: cleanName,
            image: finalImg,
            featured: categoryFeatured,
            updatedAt: serverTimestamp()
          });
          setStatusMessage({ type: "success", text: `¡Categoría "${cleanName}" actualizada exitosamente!` });
        } else {
          const nextOrder = categories.length > 0 ? Math.max(...categories.map(c => c.order || 0)) + 1 : 1;
          await addDoc(collection(db, "categories"), {
            name: cleanName,
            image: finalImg,
            order: nextOrder,
            featured: categoryFeatured,
            createdAt: serverTimestamp()
          });
          setStatusMessage({ type: "success", text: `¡Categoría "${cleanName}" creada exitosamente!` });
        }
      }

      resetCategoryForm();
      await fetchCategories();
    } catch (err: any) {
      console.error("Error saving category:", err);
      setStatusMessage({ type: "error", text: "Error al guardar categoría: " + err.message });
    } finally {
      setSavingCategory(false);
    }
  };

  const resetCategoryForm = () => {
    setCategoryName("");
    setCategoryImage("");
    setCategoryFeatured(true);
    setEditingCategoryId(null);
    setCategoryImageFile(null);
    setCategoryImagePreview("");
    if (categoryFileInputRef.current) categoryFileInputRef.current.value = "";
  };

  const handleEditCategory = (cat: CategoryItem) => {
    setEditingCategoryId(cat.id);
    setCategoryName(cat.name);
    setCategoryImage(cat.image || "");
    setCategoryImagePreview(cat.image || "");
    setCategoryFeatured(cat.featured ?? true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    const productsInCat = products.filter(p => (p.brand || p.category)?.toLowerCase() === catName.toLowerCase()).length;
    let confirmMsg = `¿Estás seguro de eliminar la categoría "${catName}"?`;
    if (productsInCat > 0) {
      confirmMsg += `\n\nAdvertencia: Hay ${productsInCat} producto(s) asignados a esta categoría.`;
    }
    if (!window.confirm(confirmMsg)) return;

    try {
      if (db) {
        await deleteDoc(doc(db, "categories", catId));
      }
      setStatusMessage({ type: "success", text: `Categoría "${catName}" eliminada.` });
      if (editingCategoryId === catId) resetCategoryForm();
      await fetchCategories();
    } catch (err: any) {
      console.error("Error deleting category:", err);
      setStatusMessage({ type: "error", text: "Error al eliminar categoría: " + err.message });
    }
  };

  const handleMoveCategory = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const currentCat = categories[index];
    const targetCat = categories[targetIndex];

    const currentOrder = currentCat.order;
    const targetOrder = targetCat.order;

    // Swap local
    const newCategories = [...categories];
    newCategories[index] = { ...targetCat, order: currentOrder };
    newCategories[targetIndex] = { ...currentCat, order: targetOrder };
    newCategories.sort((a, b) => a.order - b.order);
    setCategories(newCategories);

    try {
      if (db) {
        await updateDoc(doc(db, "categories", currentCat.id), { order: targetOrder });
        await updateDoc(doc(db, "categories", targetCat.id), { order: currentOrder });
      }
      setStatusMessage({ 
        type: "success", 
        text: `Orden actualizado: "${currentCat.name}" se movió ${direction === "up" ? "hacia arriba" : "hacia abajo"}.` 
      });
    } catch (err: any) {
      console.error("Error updating category order:", err);
      setStatusMessage({ type: "error", text: "Error al actualizar orden: " + err.message });
      await fetchCategories();
    }
  };

  const handleToggleFeaturedCategory = async (cat: CategoryItem) => {
    const newFeatured = !cat.featured;
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, featured: newFeatured } : c));
    try {
      if (db) {
        await updateDoc(doc(db, "categories", cat.id), { featured: newFeatured });
      }
      setStatusMessage({
        type: "success",
        text: `Categoría "${cat.name}" ${newFeatured ? "ahora es Destacada en Portada ★" : "ya no es Destacada"}.`
      });
    } catch (err: any) {
      console.error("Error toggling featured category:", err);
      await fetchCategories();
    }
  };

  // Verificación estricta de sesión y permisos de administrador con Custom Claims
  useEffect(() => {
    if (!auth) {
      router.push("/admin/login");
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/admin/login");
        return;
      }

      try {
        const tokenResult = await currentUser.getIdTokenResult();
        const isAuthorized = Boolean(tokenResult.claims.admin);

        if (isAuthorized) {
          setAuthChecking(false);
          fetchProducts();
          fetchLoyaltyData();
          fetchOrders();
          fetchCategories();
        } else {
          router.push("/admin/login?error=unauthorized");
        }
      } catch (err) {
        console.error("Error verificando permisos de administrador:", err);
        router.push("/admin/login?error=unauthorized");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleToggleCoupon = async (customerId: string, currentUsed: boolean) => {
    try {
      const idToken = await auth?.currentUser?.getIdToken();
      if (!idToken) throw new Error("No autenticado como administrador");

      let apiSuccess = false;
      try {
        const res = await fetch(`/api/admin/users/${customerId}/coupon`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
          },
          body: JSON.stringify({ firstPurchaseUsed: !currentUsed })
        });

        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        if (res.ok && data?.success) {
          apiSuccess = true;
        }
      } catch (apiErr) {
        console.warn("Backend API route unreachable, using direct Firestore write:", apiErr);
      }

      if (!apiSuccess && db) {
        await updateDoc(doc(db, "users", customerId), {
          firstPurchaseUsed: !currentUsed,
          updatedAt: serverTimestamp()
        });
      }

      setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, firstPurchaseUsed: !currentUsed } : c));
      setStatusMessage({
        type: "success",
        text: `Estado del cupón 15% actualizado (${!currentUsed ? "Marcado como Canjeado" : "Reactivado como Disponible"}).`
      });
    } catch (err: any) {
      console.error("Error toggling coupon", err);
      setStatusMessage({ type: "error", text: "Error al cambiar estado del cupón: " + err.message });
    }
  };

  const generateWhatsAppReceiptText = (r: OrderReceipt) => {
    const symbol = r.currency === "GTQ" ? "Q" : "$";
    const itemsText = r.items?.map(i => `* ${i.quantity}x ${i.productName}${i.volume ? ` (${i.volume})` : ""} — ${symbol}${i.totalPrice.toFixed(2)}`).join("\n") || "";
    const couponText = r.couponApplied ? `\nDescuento Bienvenida (15% en 1 producto): -${symbol}${r.discount.toFixed(2)} (${r.couponCode || "BIENVENIDA15"})` : "";
    const countryName = r.currency === "GTQ" ? "Guatemala" : "El Salvador";
    
    return encodeURIComponent(
      `RECIBO OFICIAL — LILIANA SALON\n` +
      `Recibo No: #${r.orderNumber}\n` +
      `Cliente: ${r.customerName} (${r.customerEmail})\n` +
      `----------------------------------------\n` +
      `${itemsText}\n` +
      `----------------------------------------\n` +
      `Subtotal: ${symbol}${r.subtotal.toFixed(2)}${couponText}\n` +
      `TOTAL COBRADO: ${symbol}${r.total.toFixed(2)} ${r.currency}\n` +
      `Método de pago: ${r.paymentMethod}\n` +
      `Puntos acumulados con esta compra: +${r.pointsEarned} pts\n` +
      `----------------------------------------\n` +
      `¡Muchísimas gracias por tu compra en Liliana Salon!\n` +
      `Liliana Salon • Cuidado Capilar Profesional (${countryName})`
    );
  };

  const handleMarkOrderCompleted = async (order: OrderReceipt) => {
    if (!order.id) return;
    try {
      const idToken = await auth?.currentUser?.getIdToken();
      if (!idToken) throw new Error("No autenticado como administrador");

      let apiSuccess = false;
      let apiMessage = "";

      // 1. Intentar completar mediante ruta segura del servidor
      try {
        const res = await fetch(`/api/admin/orders/${order.id}/complete`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${idToken}`
          }
        });

        const text = await res.text();
        let data: any = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch (_) {}

        if (res.ok && data?.success) {
          apiSuccess = true;
          apiMessage = data.message;
        }
      } catch (fetchErr) {
        console.warn("Backend API route unreachable, using direct Firestore transaction:", fetchErr);
      }

      // 2. Fallback de alta disponibilidad directo en Firestore si el backend en serverless tiene demora
      if (!apiSuccess && db) {
        const orderRef = doc(db, "orders", order.id);
        await updateDoc(orderRef, {
          status: "completada",
          confirmedAt: serverTimestamp(),
          confirmedBy: auth?.currentUser?.email || "admin",
          updatedAt: serverTimestamp()
        });

        // Actualizar inventario de productos de forma segura
        for (const item of order.items || []) {
          if (item.productId) {
            const prodRef = doc(db, "products", item.productId);
            const prodSnap = await getDoc(prodRef);
            if (prodSnap.exists()) {
              const currentStock = Number(prodSnap.data()?.stock) || 0;
              const newStock = Math.max(0, currentStock - (Number(item.quantity) || 1));
              await updateDoc(prodRef, {
                stock: newStock,
                updatedAt: serverTimestamp()
              });
            }
          }
        }

        // Actualizar cuenta del cliente (puntos y cupón)
        if (order.customerId && order.customerId !== "manual" && order.customerId !== "guest") {
          const userRef = doc(db, "users", order.customerId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data() || {};
            const currentPoints = Number(userData.points) || 0;
            const pointsEarned = Number(order.pointsEarned) || 0;
            const pointsRedeemed = Number((order as any).pointsRedeemed) || 0;
            const updates: Record<string, any> = {
              points: Math.max(0, currentPoints - pointsRedeemed + pointsEarned),
              updatedAt: serverTimestamp()
            };
            if (order.couponApplied) {
              updates.firstPurchaseUsed = true;
            }
            await updateDoc(userRef, updates);
          }
        }

        apiMessage = `¡Pedido #${order.orderNumber} marcado como Compra Efectuada exitosamente!`;
      }

      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: "completada" } : o));

      if (order.customerId && order.customerId !== "manual" && order.customerId !== "guest") {
        const redeemed = Number((order as any).pointsRedeemed) || 0;
        setCustomers(prev => prev.map(c => c.id === order.customerId ? { 
          ...c, 
          points: Math.max(0, (c.points || 0) - redeemed + (order.pointsEarned || 0)), 
          firstPurchaseUsed: order.couponApplied ? true : c.firstPurchaseUsed 
        } : c));
      }

      // Refrescar lista de productos para reflejar inventario actualizado
      fetchProducts();

      setStatusMessage({ 
        type: "success", 
        text: apiMessage || `¡Pedido #${order.orderNumber} marcado como Compra Efectuada exitosamente!` 
      });
    } catch (err: any) {
      console.error("Error marking completed", err);
      setStatusMessage({ type: "error", text: "Error al marcar como completado: " + err.message });
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      setStatusMessage({ type: "error", text: "Por favor selecciona un producto para emitir el recibo." });
      return;
    }
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    setGeneratingReceipt(true);
    try {
      const isRegistered = selectedCustomerId && selectedCustomerId !== "manual";
      const customer = isRegistered ? customers.find(c => c.id === selectedCustomerId) : null;
      
      const cName = customer?.name || manualCustomerName.trim() || "Cliente";
      const cEmail = customer?.email || manualCustomerEmail.trim() || "cliente@lilianasalon.com";
      const cPhone = manualCustomerPhone.trim() || "";

      const unitPrice = orderCurrency === "GTQ" 
        ? product.price 
        : (product.priceUSD || convertGTQtoUSD(product.price));
      
      const subtotal = unitPrice * orderQuantity;
      // Regla: El 15% aplica solo a 1 producto y solo 1 vez
      const canUseCoupon = Boolean(isRegistered && !customer?.firstPurchaseUsed && applyWelcomeCoupon);
      const discount = canUseCoupon ? roundToCommercialPrice(unitPrice * 0.15) : 0;
      const total = Math.max(0, subtotal - discount);

      const pointsEarned = orderCurrency === "GTQ" 
        ? Math.floor(total / 10) 
        : Math.floor(total / 1.25);

      const orderNumber = `LS-${Date.now().toString().slice(-6)}`;

      const newReceipt: OrderReceipt = {
        id: "",
        orderNumber,
        customerId: customer?.id || "manual",
        customerName: cName,
        customerEmail: cEmail,
        customerPhone: cPhone,
        items: [
          {
            productId: product.id || "",
            productName: product.name || "",
            brand: product.brand || product.category || "Liliana Salon",
            volume: product.volume || "",
            quantity: orderQuantity,
            unitPrice,
            totalPrice: subtotal
          }
        ],
        currency: orderCurrency,
        subtotal,
        discount,
        couponApplied: canUseCoupon,
        couponCode: canUseCoupon ? (customer?.welcomeCoupon || "BIENVENIDA15") : null,
        total,
        paymentMethod: paymentMethod || "Transferencia / Depósito",
        pointsEarned,
        status: "completada",
        notes: orderNotes || "",
        createdAt: new Date().toISOString()
      };

      if (db) {
        // 1. Guardar orden en colección "orders"
        const docRef = await addDoc(collection(db, "orders"), {
          ...newReceipt,
          createdAt: serverTimestamp()
        });
        newReceipt.id = docRef.id;

        // 2. Si el cliente está registrado: quemar cupón y sumar puntos
        if (customer && customer.id) {
          const userRef = doc(db, "users", customer.id);
          const updates: any = {
            points: (customer.points || 0) + pointsEarned,
            updatedAt: serverTimestamp()
          };
          if (canUseCoupon) {
            updates.firstPurchaseUsed = true;
          }
          await updateDoc(userRef, updates);

          // Actualizar estado local de customers
          setCustomers(prev => prev.map(c => {
            if (c.id === customer.id) {
              return {
                ...c,
                points: (c.points || 0) + pointsEarned,
                firstPurchaseUsed: canUseCoupon ? true : c.firstPurchaseUsed
              };
            }
            return c;
          }));
        }

        // 3. Descontar stock
        if (product.stock > 0) {
          const newStock = Math.max(0, product.stock - orderQuantity);
          await updateDoc(doc(db, "products", product.id), {
            stock: newStock,
            updatedAt: serverTimestamp()
          });
          setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock: newStock } : p));
        }
      }

      setOrders(prev => [newReceipt, ...prev]);
      setActiveReceipt(newReceipt);
      setStatusMessage({ 
        type: "success", 
        text: `¡Recibo #${orderNumber} emitido exitosamente! ${canUseCoupon ? "El cupón del 15% ha sido quemado/marcado como canjeado." : ""}` 
      });

      // Limpiar formulario
      setSelectedProductId("");
      setOrderQuantity(1);
      setOrderNotes("");
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: "error", text: "Error al emitir recibo: " + err.message });
    } finally {
      setGeneratingReceipt(false);
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const { dataUrl, blob } = await compressImage(file, 900, 0.82);
        setImageFile(new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" }));
        setImagePreview(dataUrl);
        setImage(dataUrl);
      } catch (err) {
        console.warn("Image compression error, using raw:", err);
        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          setImagePreview(result);
          setImage(result);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const uploadImageIfNeeded = async (): Promise<string> => {
    if (imageFile && storage) {
      try {
        const storageRef = ref(storage, `products/${Date.now()}_${imageFile.name}`);
        const uploadPromise = uploadBytes(storageRef, imageFile).then(snapshot => getDownloadURL(snapshot.ref));
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Storage timeout")), 3500)
        );
        const downloadUrl = await Promise.race([uploadPromise, timeoutPromise]);
        return downloadUrl;
      } catch (err) {
        console.warn("Storage upload skipped or timed out, using optimized image:", err);
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

      // Auto-registrar categoría en Firestore si se creó como personalizada
      if (db && finalCategory && !categories.some(c => c.name.toLowerCase() === finalCategory.toLowerCase())) {
        try {
          const nextOrder = categories.length > 0 ? Math.max(...categories.map(c => c.order || 0)) + 1 : 1;
          await addDoc(collection(db, "categories"), {
            name: finalCategory,
            image: finalImageUrl || "https://images.unsplash.com/photo-1599305090598-fe179d501227?q=80&w=400&auto=format&fit=crop",
            order: nextOrder,
            featured: true,
            createdAt: serverTimestamp()
          });
          fetchCategories();
        } catch (catErr) {
          console.warn("Could not auto-register category:", catErr);
        }
      }

      const parsedPriceQ = parseFloat(price) || 0;
      const parsedPriceUSD = priceUSD ? parseFloat(priceUSD) : convertGTQtoUSD(parsedPriceQ);
      const parsedOldPriceQ = oldPrice ? parseFloat(oldPrice) : null;
      const parsedOldPriceUSD = oldPriceUSD ? parseFloat(oldPriceUSD) : (parsedOldPriceQ ? convertGTQtoUSD(parsedOldPriceQ) : null);

      const productPayload = {
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
      };

      let saved = false;

      // 1. Intentar primero con el cliente Firestore (con timeout de 4.5 segundos)
      if (db) {
        try {
          const clientPromise = editingId
            ? updateDoc(doc(db, "products", editingId), { ...productPayload, updatedAt: serverTimestamp() })
            : addDoc(collection(db, "products"), { ...productPayload, createdAt: serverTimestamp() });

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout cliente Firestore")), 4500)
          );

          await Promise.race([clientPromise, timeoutPromise]);
          saved = true;
          setStatusMessage({
            type: "success",
            text: `¡Producto ${editingId ? "actualizado" : "guardado"} exitosamente en Firebase!`
          });
        } catch (clientErr: any) {
          console.warn("Direct Firestore write timed out or rejected, switching to server API fallback:", clientErr);
        }
      }

      // 2. Si el cliente falló o expiró, usar la API de administración del servidor
      if (!saved) {
        try {
          const idToken = await auth?.currentUser?.getIdToken();
          const res = await fetch("/api/admin/products", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(idToken ? { "Authorization": `Bearer ${idToken}` } : {})
            },
            body: JSON.stringify({ ...productPayload, ...(editingId ? { id: editingId } : {}) })
          });

          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              saved = true;
              setStatusMessage({
                type: "success",
                text: `¡Producto ${editingId ? "actualizado" : "guardado"} exitosamente en Firebase!`
              });
            }
          } else {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Error al guardar producto en el servidor.");
          }
        } catch (apiErr: any) {
          console.error("API route product save failed:", apiErr);
          if (!saved) throw apiErr;
        }
      }

      resetForm();
      await fetchProducts();
    } catch (e: any) {
      console.error("Error saving product:", e);
      setStatusMessage({ type: "error", text: "Error al guardar producto: " + (e.message || "Por favor verifica los datos.") });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este producto?")) return;
    try {
      let deleted = false;
      if (db) {
        try {
          const clientPromise = deleteDoc(doc(db, "products", id));
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout delete")), 4000)
          );
          await Promise.race([clientPromise, timeoutPromise]);
          deleted = true;
        } catch (clientErr) {
          console.warn("Client deleteDoc timed out, using server API fallback:", clientErr);
        }
      }

      if (!deleted) {
        const idToken = await auth?.currentUser?.getIdToken();
        const res = await fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: {
            ...(idToken ? { "Authorization": `Bearer ${idToken}` } : {})
          }
        });
        if (res.ok) deleted = true;
      }

      setStatusMessage({ type: "success", text: "Producto eliminado exitosamente de Firebase." });
      await fetchProducts();
    } catch (e: any) {
      console.error("Error deleting", e);
      setStatusMessage({ type: "error", text: "Error al eliminar: " + e.message });
    }
  };

  const handleEdit = (p: Product) => {
    setEditingId(p.id);
    setName(p.name);
    const catName = p.brand || p.category || "";
    if (categories.some(c => c.name.toLowerCase() === catName.toLowerCase())) {
      setCategory(catName);
      setCustomCategory("");
    } else {
      setCategory("Otra");
      setCustomCategory(catName);
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
                fetchOrders();
                fetchCategories();
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-6 sm:gap-8 border-t border-stone-100 text-xs font-semibold uppercase tracking-wider overflow-x-auto">
          <button
            onClick={() => setActiveTab("products")}
            className={`py-3 flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === "products" 
                ? "border-black text-black font-bold" 
                : "border-transparent text-stone-400 hover:text-stone-700"
            }`}
          >
            <Package size={15} /> Productos & Inventario ({products.length})
          </button>
          <button
            onClick={() => setActiveTab("categories")}
            className={`py-3 flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === "categories" 
                ? "border-black text-black font-bold" 
                : "border-transparent text-stone-400 hover:text-stone-700"
            }`}
          >
            <Layers size={15} className="text-[#C08261]" /> Categorías & Destacados ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`py-3 flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === "orders" 
                ? "border-black text-black font-bold" 
                : "border-transparent text-stone-400 hover:text-stone-700"
            }`}
          >
            <Receipt size={15} className="text-[#C08261]" /> Pedidos & Recibos ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab("loyalty")}
            className={`py-3 flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
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
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Categoría / Marca *
                      </label>
                      <button
                        type="button"
                        onClick={() => setActiveTab("categories")}
                        className="text-[10px] text-[#C08261] hover:underline font-bold"
                      >
                        + Administrar
                      </button>
                    </div>
                    <select 
                      value={category} 
                      onChange={e => setCategory(e.target.value)} 
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-black"
                    >
                      {(categories.length > 0 ? categories : DEFAULT_CATEGORIES.map((c, i) => ({ id: `default-${i}`, ...c }))).map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                      <option value="Otra">➕ Otra (escribir nueva)...</option>
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

        {/* TAB 2: PEDIDOS Y GENERADOR DE RECIBOS */}
        {activeTab === "orders" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Formulario para emitir nuevo recibo / venta */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-200 lg:col-span-5">
              <div className="flex items-center gap-2 mb-2">
                <Receipt size={20} className="text-[#C08261]" />
                <h2 className="text-lg font-serif font-medium">Emitir Recibo & Registrar Venta</h2>
              </div>
              <p className="text-xs text-gray-500 mb-6 border-b border-stone-100 pb-4">
                Genera el recibo formal de compra, valida el cupón del 15% por correo y acredita los puntos al cliente.
              </p>

              <form onSubmit={handleCreateOrder} className="space-y-5">
                {/* 1. Selección de Cliente */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Cliente / Comprador *</span>
                    <span className="text-[10px] text-stone-400 font-normal">Asocia el correo para el cupón</span>
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => {
                      const cid = e.target.value;
                      setSelectedCustomerId(cid);
                      if (cid && cid !== "manual") {
                        const c = customers.find(item => item.id === cid);
                        if (c) {
                          setManualCustomerName(c.name || "");
                          setManualCustomerEmail(c.email || "");
                          // Si ya usó el cupón, no puede activarlo
                          setApplyWelcomeCoupon(!c.firstPurchaseUsed);
                        }
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
                  >
                    <option value="">-- Selecciona un cliente registrado --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || "Cliente"} ({c.email}) {c.firstPurchaseUsed ? "• [Cupón 15% YA USADO]" : "• [15% DISPONIBLE ✨]"}
                      </option>
                    ))}
                    <option value="manual">➕ Cliente sin registrar / Ocasional</option>
                  </select>
                </div>

                {/* Si seleccionó cliente registrado: Tarjeta de Estado del Cupón */}
                {selectedCustomerId && selectedCustomerId !== "manual" && (
                  (() => {
                    const c = customers.find(item => item.id === selectedCustomerId);
                    if (!c) return null;
                    const canUseCoupon = !c.firstPurchaseUsed;

                    return (
                      <div className={`p-3.5 rounded-xl border text-xs ${
                        canUseCoupon 
                          ? "bg-emerald-50/80 border-emerald-200 text-emerald-900" 
                          : "bg-stone-50 border-stone-200 text-stone-700"
                      }`}>
                        <div className="flex items-center justify-between font-bold mb-1">
                          <span className="flex items-center gap-1.5">
                            {canUseCoupon ? <Gift size={14} className="text-emerald-600" /> : <AlertCircle size={14} className="text-stone-400" />}
                            {canUseCoupon ? "Cupón 15% Disponible (BIENVENIDA15)" : "Cupón 15% No Disponible"}
                          </span>
                          <span className="bg-white/80 px-2 py-0.5 rounded-full border border-stone-200 font-bold text-[11px]">
                            {c.points || 0} pts
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-stone-600">
                          {canUseCoupon 
                            ? `Autorizado para este correo (${c.email}). Se quemará y marcará como canjeado automáticamente al emitir este recibo.` 
                            : `Este cliente ya utilizó su cupón del 15% en una compra previa. Solo aplica precio normal con acumulación de puntos.`}
                        </p>
                      </div>
                    );
                  })()
                )}

                {/* Campos manuales si seleccionó cliente sin registrar */}
                {selectedCustomerId === "manual" && (
                  <div className="space-y-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">Nombre</label>
                      <input
                        type="text"
                        required
                        value={manualCustomerName}
                        onChange={(e) => setManualCustomerName(e.target.value)}
                        placeholder="Nombre completo"
                        className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">Correo electrónico</label>
                      <input
                        type="email"
                        value={manualCustomerEmail}
                        onChange={(e) => setManualCustomerEmail(e.target.value)}
                        placeholder="correo@ejemplo.com"
                        className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* 2. Moneda / País del Pedido */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Moneda de Facturación
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setOrderCurrency("GTQ")}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                        orderCurrency === "GTQ"
                          ? "bg-black text-white border-black"
                          : "bg-white text-stone-700 border-stone-300 hover:border-stone-400"
                      }`}
                    >
                      🇬🇹 Guatemala (Quetzales Q)
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderCurrency("USD")}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                        orderCurrency === "USD"
                          ? "bg-black text-white border-black"
                          : "bg-white text-stone-700 border-stone-300 hover:border-stone-400"
                      }`}
                    >
                      🇸🇻 El Salvador ($ USD)
                    </button>
                  </div>
                </div>

                {/* 3. Selección de Producto y Cantidad */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Producto Vendido *
                    </label>
                    <select
                      required
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
                    >
                      <option value="">-- Seleccionar producto del catálogo --</option>
                      {products.map((p) => {
                        const pPrice = orderCurrency === "GTQ" ? `Q${p.price.toFixed(2)}` : `$${(p.priceUSD || convertGTQtoUSD(p.price)).toFixed(2)} USD`;
                        return (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.volume ? `(${p.volume})` : ""} — {pPrice} (Stock: {p.stock})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                        Cantidad
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={orderQuantity}
                        onChange={(e) => setOrderQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                        Teléfono WhatsApp
                      </label>
                      <input
                        type="text"
                        value={manualCustomerPhone}
                        onChange={(e) => setManualCustomerPhone(e.target.value)}
                        placeholder="Ej. 50242083721"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Casilla de Cupón de Bienvenida 15% */}
                {(() => {
                  const c = selectedCustomerId && selectedCustomerId !== "manual" 
                    ? customers.find(item => item.id === selectedCustomerId) 
                    : null;
                  const isCouponBlocked = c?.firstPurchaseUsed === true;

                  return (
                    <div className="pt-2 pb-2">
                      <label className={`flex items-start gap-3 p-3.5 rounded-xl border transition ${
                        isCouponBlocked 
                          ? "bg-stone-50 border-stone-200 opacity-60 cursor-not-allowed" 
                          : applyWelcomeCoupon 
                          ? "bg-[#FAF3EC] border-[#C08261]/60 text-stone-900 cursor-pointer shadow-xs" 
                          : "bg-white border-stone-200 text-stone-700 cursor-pointer"
                      }`}>
                        <input
                          type="checkbox"
                          disabled={isCouponBlocked}
                          checked={applyWelcomeCoupon && !isCouponBlocked}
                          onChange={(e) => setApplyWelcomeCoupon(e.target.checked)}
                          className="mt-0.5 rounded text-[#C08261] focus:ring-[#C08261] w-4 h-4"
                        />
                        <div className="text-xs">
                          <span className="font-bold block text-stone-900">
                            Aplicar Descuento de Bienvenida 15% OFF (BIENVENIDA15)
                          </span>
                          <span className="text-[11px] text-stone-500 block mt-0.5">
                            {isCouponBlocked 
                              ? "⚠️ Este cliente ya canjeó su cupón de primera compra. No se puede reutilizar."
                              : "*Aplica exclusivamente en 1 producto. Al emitir este recibo se marcará como canjeado en su cuenta."}
                          </span>
                        </div>
                      </label>
                    </div>
                  );
                })()}

                {/* 5. Desglose de Cálculo en Tiempo Real */}
                {selectedProductId && (
                  (() => {
                    const prod = products.find(p => p.id === selectedProductId);
                    if (!prod) return null;
                    const c = selectedCustomerId && selectedCustomerId !== "manual" 
                      ? customers.find(item => item.id === selectedCustomerId) 
                      : null;
                    const canApply = applyWelcomeCoupon && (!c || !c.firstPurchaseUsed);

                    const uPrice = orderCurrency === "GTQ" 
                      ? prod.price 
                      : (prod.priceUSD || convertGTQtoUSD(prod.price));
                    
                    const subtotal = uPrice * orderQuantity;
                    // El 15% aplica solo a 1 unidad del producto por regla
                    const discount = canApply ? roundToCommercialPrice(uPrice * 0.15) : 0;
                    const finalTotal = Math.max(0, subtotal - discount);
                    const pts = orderCurrency === "GTQ" ? Math.floor(finalTotal / 10) : Math.floor(finalTotal / 1.25);
                    const symbol = orderCurrency === "GTQ" ? "Q" : "$";

                    return (
                      <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 text-xs space-y-2">
                        <div className="flex justify-between text-stone-600">
                          <span>Subtotal ({orderQuantity}x {prod.name}):</span>
                          <span className="font-semibold">{symbol}{subtotal.toFixed(2)}</span>
                        </div>
                        {discount > 0 && (
                          <div className="flex justify-between text-emerald-700 font-semibold bg-emerald-100/60 p-1.5 rounded">
                            <span className="flex items-center gap-1">
                              <Gift size={12} /> Descuento 15% (1 unidad):
                            </span>
                            <span>-{symbol}{discount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-stone-900 font-bold text-sm pt-2 border-t border-stone-200">
                          <span>Total a Cobrar:</span>
                          <span className="text-base text-gray-900">{symbol}{finalTotal.toFixed(2)} {orderCurrency}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#A8623D] font-medium pt-1">
                          <span className="flex items-center gap-1"><Coins size={12} /> Puntos generados para el cliente:</span>
                          <span className="font-bold">+{pts} pts</span>
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* 6. Método de pago */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Método de Pago
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="Transferencia / Depósito">Transferencia / Depósito bancario</option>
                    <option value="Pago Contra Entrega">Pago Contra Entrega (Efectivo)</option>
                    <option value="Tarjeta de Crédito / Débito">Tarjeta de Crédito / Débito</option>
                    <option value="Pago en Salón">Pago directo en Salón</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={generatingReceipt || !selectedProductId}
                  className="w-full bg-[#B85728] hover:bg-[#9E461D] text-white py-3.5 rounded-xl text-xs font-bold tracking-widest uppercase transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Receipt size={16} />
                  {generatingReceipt ? "Emitiendo Recibo..." : "GENERAR RECIBO OFICIAL & REGISTRAR VENTA"}
                </button>
              </form>
            </div>

            {/* Historial de Recibos Emitidos */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-200 lg:col-span-7">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-stone-100 gap-3">
                <div>
                  <h2 className="text-lg font-serif font-medium flex items-center gap-2">
                    <FileText size={18} className="text-[#C08261]" /> Recibos Emitidos ({orders.length})
                  </h2>
                  <p className="text-xs text-gray-500">Historial de órdenes, recibos y cupones canjeados</p>
                </div>

                {/* Buscador de recibos */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Buscar cliente o recibo..."
                    value={receiptFilter}
                    onChange={(e) => setReceiptFilter(e.target.value)}
                    className="pl-8 pr-3 py-1.5 border border-stone-200 rounded-lg text-xs w-full sm:w-48 focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
              </div>

              {orders.length === 0 ? (
                <div className="py-20 text-center text-stone-400 text-sm">
                  Aún no se han generado recibos de venta.
                </div>
              ) : (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-stone-100 text-xs text-gray-400 uppercase tracking-wider">
                        <th className="py-3 px-2">Recibo #</th>
                        <th className="py-3 px-2">Cliente</th>
                        <th className="py-3 px-2">Producto(s)</th>
                        <th className="py-3 px-2">Total</th>
                        <th className="py-3 px-2 text-center">Estado</th>
                        <th className="py-3 px-2 text-center">15% Usado</th>
                        <th className="py-3 px-2 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {orders
                        .filter(o => {
                          if (!receiptFilter.trim()) return true;
                          const q = receiptFilter.toLowerCase();
                          return o.orderNumber.toLowerCase().includes(q) || 
                            o.customerName.toLowerCase().includes(q) || 
                            o.customerEmail.toLowerCase().includes(q);
                        })
                        .map((order) => {
                          const symbol = order.currency === "GTQ" ? "Q" : "$";
                          const isCompleted = order.status === "completada";

                          return (
                            <tr key={order.id || order.orderNumber} className="hover:bg-stone-50/70 transition">
                              <td className="py-3 px-2 font-mono text-xs font-bold text-gray-900">
                                #{order.orderNumber}
                              </td>
                              <td className="py-3 px-2 text-xs">
                                <div className="font-semibold text-gray-900">{order.customerName}</div>
                                <div className="text-[11px] text-stone-400">{order.customerEmail}</div>
                              </td>
                              <td className="py-3 px-2 text-xs text-stone-700">
                                {order.items?.map((it, idx) => (
                                  <div key={idx} className="truncate max-w-[150px]">
                                    {it.productName} {it.volume && `(${it.volume})`} x{it.quantity}
                                  </div>
                                ))}
                              </td>
                              <td className="py-3 px-2 text-xs font-bold text-gray-900">
                                {symbol}{order.total?.toFixed(2)}
                              </td>
                              <td className="py-3 px-2 text-center text-xs">
                                {isCompleted ? (
                                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                    <CheckCircle2 size={10} /> Efectuada
                                  </span>
                                ) : (
                                  <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                    <Clock size={10} className="animate-pulse" /> Pendiente
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-2 text-center text-xs">
                                {order.couponApplied ? (
                                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                    <Check size={10} /> 15% OFF
                                  </span>
                                ) : (
                                  <span className="text-stone-300 text-xs">—</span>
                                )}
                              </td>
                              <td className="py-3 px-2 text-right">
                                <div className="inline-flex items-center gap-1.5 justify-end">
                                  {!isCompleted && (
                                    <button
                                      onClick={() => handleMarkOrderCompleted(order)}
                                      className="text-xs bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-stone-950 px-2.5 py-1.5 rounded-lg font-bold transition inline-flex items-center gap-1 shadow-2xs"
                                      title="Marcar pago verificado y otorgar puntos"
                                    >
                                      <CheckCircle2 size={12} /> Compra Efectuada
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setActiveReceipt(order)}
                                    className="text-xs bg-stone-100 hover:bg-black hover:text-white px-2.5 py-1.5 rounded-lg font-semibold transition inline-flex items-center gap-1 shadow-2xs"
                                  >
                                    <Printer size={13} /> Recibo
                                  </button>
                                  {order.id && (
                                    <a
                                      href={`/pedido/${order.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-2 py-1.5 rounded-lg transition inline-flex items-center"
                                      title="Verificar enlace oficial en web"
                                    >
                                      <ExternalLink size={12} />
                                    </a>
                                  )}
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

        {/* TAB 3: PUNTOS Y FIDELIZACIÓN */}
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
                        <th className="py-3 px-2 text-center">Cupón 15%</th>
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
                            {c.firstPurchaseUsed ? (
                              <button
                                onClick={() => handleToggleCoupon(c.id, true)}
                                title="Clic para reactivar el cupón a este cliente"
                                className="inline-flex items-center gap-1 bg-stone-100 text-stone-600 hover:bg-stone-200 text-[10px] font-bold px-2 py-0.5 rounded-full transition"
                              >
                                🔴 Canjeado <RotateCcw size={10} />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleCoupon(c.id, false)}
                                title="Clic para marcar como canjeado"
                                className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full transition"
                              >
                                🟢 Disponible (15%)
                              </button>
                            )}
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

        {/* TAB 4: GESTOR DE CATEGORÍAS & DESTACADOS */}
        {activeTab === "categories" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Formulario de Creación / Edición */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-200 lg:col-span-5">
              <div className="flex justify-between items-center mb-6 border-b border-stone-100 pb-4">
                <div>
                  <h2 className="text-lg font-serif font-medium flex items-center gap-2">
                    <Layers size={18} className="text-[#C08261]" />
                    {editingCategoryId ? "Editar Categoría" : "Crear Nueva Categoría"}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {editingCategoryId 
                      ? "Modifica el nombre, imagen o posición de la categoría." 
                      : "Agrega nuevas marcas o categorías a la tienda."}
                  </p>
                </div>
                {editingCategoryId && (
                  <button 
                    type="button" 
                    onClick={resetCategoryForm} 
                    className="text-xs text-stone-500 hover:text-black underline"
                  >
                    Nueva
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveCategory} className="space-y-4">
                {/* Nombre */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Nombre de la Categoría *
                  </label>
                  <input
                    required
                    type="text"
                    value={categoryName}
                    onChange={e => setCategoryName(e.target.value)}
                    placeholder="Ej. Tratamientos Capilares, Maquillaje..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                {/* Imagen */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Imagen de Portada (Para carrusel circular)
                  </label>
                  <div className="flex gap-3 items-center">
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-stone-300 bg-stone-50 flex items-center justify-center overflow-hidden shrink-0">
                      {categoryImagePreview || categoryImage ? (
                        <img 
                          src={categoryImagePreview || categoryImage} 
                          alt="Preview" 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <ImageIcon size={20} className="text-stone-400" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <input
                        type="file"
                        accept="image/*"
                        ref={categoryFileInputRef}
                        onChange={handleCategoryFileChange}
                        className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-stone-100 file:text-stone-700 hover:file:bg-stone-200 cursor-pointer w-full"
                      />
                      <input
                        type="url"
                        value={categoryImage}
                        onChange={e => {
                          setCategoryImage(e.target.value);
                          setCategoryImagePreview(e.target.value);
                        }}
                        placeholder="O pega una URL de imagen..."
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black"
                      />
                    </div>
                  </div>
                </div>

                {/* Destacada en Portada */}
                <div className="pt-2">
                  <label className="flex items-center gap-2.5 text-xs text-stone-700 font-medium cursor-pointer p-3 bg-stone-50 rounded-xl border border-stone-200/80">
                    <input
                      type="checkbox"
                      checked={categoryFeatured}
                      onChange={e => setCategoryFeatured(e.target.checked)}
                      className="w-4 h-4 rounded text-black focus:ring-black border-stone-300"
                    />
                    <div>
                      <span className="font-bold text-gray-900 block flex items-center gap-1">
                        <Star size={13} className="text-amber-500 fill-amber-500" /> Mostrar destacada en portada
                      </span>
                      <span className="text-[11px] text-stone-500">
                        Aparecerá en el carrusel circular superior de la tienda principal.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Botón Guardar */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingCategory}
                    className="w-full bg-black hover:bg-stone-800 text-white font-semibold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition disabled:opacity-50"
                  >
                    {savingCategory ? (
                      <span>Guardando Categoría...</span>
                    ) : (
                      <>
                        <Plus size={15} /> {editingCategoryId ? "Actualizar Categoría" : "Guardar Nueva Categoría"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Lista y Reordenamiento de Categorías */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-200 lg:col-span-7 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
                <div>
                  <h3 className="text-lg font-serif font-medium">Orden de Visualización & Prioridad</h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Organiza las categorías con las flechas ⬆️ / ⬇️. Las primeras se mostrarán al inicio en los filtros y carrusel.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchCategories}
                    disabled={loadingCategories}
                    className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-600 text-xs flex items-center gap-1.5 transition"
                    title="Recargar desde la base de datos"
                  >
                    <RotateCcw size={13} className={loadingCategories ? "animate-spin" : ""} />
                    <span>Recargar</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRestoreDefaultCategories}
                    disabled={loadingCategories}
                    className="px-2.5 py-2 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-medium flex items-center gap-1.5 transition"
                    title="Restaurar o sincronizar categorías iniciales"
                  >
                    <Sparkles size={13} className="text-amber-600" />
                    <span>Sincronizar Base</span>
                  </button>
                </div>
              </div>

              <div className="bg-amber-50/70 border border-amber-200/80 p-3 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <Sparkles size={15} className="text-[#C08261] shrink-0 mt-0.5" />
                <p className="leading-relaxed text-[11px]">
                  <strong>Tip de Destacados:</strong> La categoría en la posición <strong>#1</strong> será la primera visible después del botón &quot;TODOS&quot;. Las que tengan la estrella <strong>★</strong> aparecerán en las fotos circulares de la tienda.
                </p>
              </div>

              {loadingCategories && categories.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-400 flex flex-col items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-[#C08261] border-t-transparent rounded-full animate-spin"></div>
                  <span>Cargando categorías de la base de datos...</span>
                </div>
              ) : categories.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-500 bg-stone-50 rounded-xl border border-dashed border-stone-200 p-6 space-y-3">
                  <p>No se encontraron categorías en la base de datos.</p>
                  <button
                    type="button"
                    onClick={handleRestoreDefaultCategories}
                    className="px-4 py-2 bg-black text-white text-[11px] font-bold rounded-lg uppercase tracking-wider hover:bg-stone-800 transition"
                  >
                    Inicializar Categorías Base
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {categories.map((cat, idx) => {
                    const count = products.filter(p => (p.brand || p.category)?.toLowerCase() === cat.name.toLowerCase()).length;
                    const isFirst = idx === 0;
                    const isLast = idx === categories.length - 1;

                    return (
                      <div 
                        key={cat.id}
                        className="flex items-center justify-between p-3.5 bg-stone-50/80 hover:bg-stone-100/60 rounded-xl border border-stone-200/90 transition shadow-2xs gap-3"
                      >
                        {/* Posición e Imagen */}
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-stone-200 text-stone-700 text-xs font-bold flex items-center justify-center font-mono shrink-0">
                            #{idx + 1}
                          </span>
                          <div className="w-11 h-11 rounded-full overflow-hidden border border-stone-200 bg-white shrink-0">
                            <img 
                              src={cat.image || "https://images.unsplash.com/photo-1599305090598-fe179d501227?q=80&w=400&auto=format&fit=crop"} 
                              alt={cat.name} 
                              className="w-full h-full object-cover" 
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-gray-900 truncate">{cat.name}</span>
                              {cat.featured && (
                                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full inline-flex items-center gap-0.5 border border-amber-200">
                                  <Star size={9} className="fill-amber-600 text-amber-600" /> Destacada
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-stone-500 block">
                              {count} {count === 1 ? "producto asignado" : "productos asignados"}
                            </span>
                          </div>
                        </div>

                        {/* Controles de Orden y Acciones */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Botón Subir Orden */}
                          <button
                            type="button"
                            disabled={isFirst}
                            onClick={() => handleMoveCategory(idx, "up")}
                            className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-200 text-stone-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                            title="Mover hacia arriba (mostrar antes)"
                          >
                            <ArrowUp size={15} />
                          </button>

                          {/* Botón Bajar Orden */}
                          <button
                            type="button"
                            disabled={isLast}
                            onClick={() => handleMoveCategory(idx, "down")}
                            className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-200 text-stone-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                            title="Mover hacia abajo (mostrar después)"
                          >
                            <ArrowDown size={15} />
                          </button>

                          {/* Toggle Destacado */}
                          <button
                            type="button"
                            onClick={() => handleToggleFeaturedCategory(cat)}
                            className={`p-1.5 rounded-lg border transition ${
                              cat.featured
                                ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
                                : "bg-white border-stone-200 text-stone-400 hover:text-stone-700"
                            }`}
                            title={cat.featured ? "Quitar de destacadas en portada" : "Destacar en portada"}
                          >
                            <Star size={15} className={cat.featured ? "fill-amber-500 text-amber-500" : ""} />
                          </button>

                          {/* Editar */}
                          <button
                            type="button"
                            onClick={() => handleEditCategory(cat)}
                            className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-stone-600 hover:text-black transition"
                            title="Editar Categoría"
                          >
                            <Edit2 size={15} />
                          </button>

                          {/* Eliminar */}
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                            className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-red-50 text-stone-400 hover:text-red-600 transition"
                            title="Eliminar Categoría"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL DE RECIBO FORMAL IMPRIMIBLE / COMPARTIBLE */}
      {activeReceipt && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in"
          onClick={() => setActiveReceipt(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-stone-200 relative my-6 text-gray-900 transform transition-all duration-300 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Recibo */}
            <div className="bg-[#FAF3EC] p-6 text-center border-b border-stone-200 relative">
              <button
                onClick={() => setActiveReceipt(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/80 hover:bg-black hover:text-white text-stone-600 flex items-center justify-center transition border border-stone-200"
              >
                <X size={16} />
              </button>

              <h3 className="text-2xl font-serif tracking-[0.15em] font-bold text-gray-900">
                LILIANA SALON
              </h3>
              <p className="text-[10px] uppercase tracking-widest text-[#A8623D] font-bold mt-1">
                Belleza & Cuidado Capilar Profesional
              </p>
              <p className="text-[11px] text-stone-500 mt-1">
                WhatsApp: +502 4208-3721 • Distribuidor Oficial Guatemala 🇬🇹 & El Salvador 🇸🇻
              </p>
            </div>

            {/* Cuerpo del Recibo */}
            <div className="p-6 space-y-5 text-xs">
              <div className="flex justify-between items-center border-b border-stone-100 pb-3">
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase tracking-wider">Recibo Oficial</span>
                  <span className="font-mono font-bold text-sm text-gray-900">#{activeReceipt.orderNumber}</span>
                </div>
                <div className="text-right">
                  <span className="text-stone-400 block text-[10px] uppercase tracking-wider">Fecha de Emisión</span>
                  <span className="font-medium text-stone-700">
                    {activeReceipt.createdAt?.seconds 
                      ? new Date(activeReceipt.createdAt.seconds * 1000).toLocaleDateString()
                      : new Date().toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Datos del Cliente */}
              <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-100">
                <span className="text-[10px] text-stone-400 uppercase tracking-wider block mb-1">Cliente Autorizado</span>
                <div className="font-bold text-sm text-gray-900">{activeReceipt.customerName}</div>
                <div className="text-stone-600 text-xs">{activeReceipt.customerEmail}</div>
                {activeReceipt.customerPhone && (
                  <div className="text-stone-500 text-[11px] flex items-center gap-1 mt-1">
                    <Phone size={11} className="text-[#25D366]" /> {activeReceipt.customerPhone}
                  </div>
                )}
              </div>

              {/* Tabla de Artículos */}
              <div className="border border-stone-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-100 text-stone-600 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="p-2.5">Detalle del Producto</th>
                      <th className="p-2.5 text-center">Cant.</th>
                      <th className="p-2.5 text-right">Precio</th>
                      <th className="p-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {activeReceipt.items?.map((it, idx) => {
                      const sym = activeReceipt.currency === "GTQ" ? "Q" : "$";
                      return (
                        <tr key={idx}>
                          <td className="p-2.5 font-medium">
                            {it.productName} {it.volume && <span className="text-stone-500 font-normal">({it.volume})</span>}
                          </td>
                          <td className="p-2.5 text-center">{it.quantity}</td>
                          <td className="p-2.5 text-right text-stone-600">{sym}{it.unitPrice.toFixed(2)}</td>
                          <td className="p-2.5 text-right font-semibold">{sym}{it.totalPrice.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totales y Descuentos */}
              <div className="space-y-1.5 pt-2 border-t border-stone-100">
                {(() => {
                  const sym = activeReceipt.currency === "GTQ" ? "Q" : "$";
                  return (
                    <>
                      <div className="flex justify-between text-stone-600">
                        <span>Subtotal:</span>
                        <span>{sym}{activeReceipt.subtotal.toFixed(2)}</span>
                      </div>
                      {activeReceipt.couponApplied && (
                        <div className="flex justify-between text-emerald-800 font-semibold bg-emerald-50 px-2 py-1 rounded">
                          <span className="flex items-center gap-1">
                            <Gift size={12} /> Descuento 15% Bienvenida (1 producto):
                          </span>
                          <span>-{sym}{activeReceipt.discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-stone-600 pt-1">
                        <span>Método de pago:</span>
                        <span className="font-medium text-stone-800">{activeReceipt.paymentMethod}</span>
                      </div>
                      <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-stone-200">
                        <span>TOTAL PAGADO:</span>
                        <span>{sym}{activeReceipt.total.toFixed(2)} {activeReceipt.currency}</span>
                      </div>
                      <div className="flex items-center justify-between text-[#A8623D] font-semibold text-[11px] pt-1 bg-[#FAF3EC] p-2 rounded-lg">
                        <span className="flex items-center gap-1"><Coins size={12} /> Puntos acumulados en esta compra:</span>
                        <span className="font-bold">+{activeReceipt.pointsEarned} pts</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Mensaje de Garantía */}
              <p className="text-[10px] text-stone-400 text-center flex items-center justify-center gap-1 pt-1">
                <ShieldCheck size={12} className="text-stone-400" />
                Liliana Salon garantiza la autenticidad de los productos Keratech e IvoGa.
              </p>

              {/* Botones de Acción */}
              <div className="pt-3 border-t border-stone-200 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 bg-stone-900 hover:bg-black text-white py-3 rounded-xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition shadow-sm"
                >
                  <Printer size={15} /> Imprimir / PDF
                </button>
                <a
                  href={`https://wa.me/${(activeReceipt.customerPhone || "").replace(/[^0-9]/g, "")}?text=${generateWhatsAppReceiptText(activeReceipt)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-[#25D366] hover:bg-[#20ba59] text-white py-3 rounded-xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition shadow-sm"
                >
                  <Send size={15} /> Enviar WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
