"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { useCountry } from "@/context/CountryContext";
import { useAuth } from "@/context/AuthContext";
import { roundToCommercialPrice, convertGTQtoUSD } from "@/lib/currency";

export interface CartItem {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  volume?: string;
  priceGTQ: number;
  priceUSD?: number | null;
  image: string;
  quantity: number;
  stock: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: any, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  totalItems: number;
  subtotal: number;
  discount: number;
  wholesaleDiscount: number;
  isWholesaleDiscountApplied: boolean;
  unitsNeededForWholesale: number;
  wholesaleDiscountPercent: number;
  total: number;
  pointsToEarn: number;
  applyWelcomeCoupon: boolean;
  setApplyWelcomeCoupon: (val: boolean) => void;
  canApplyWelcomeCoupon: boolean;
  couponDiscountItem: CartItem | null;
  currencySymbol: string;
  currencyCode: "GTQ" | "USD";
  getItemUnitPrice: (item: CartItem) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "liliana_salon_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [applyWelcomeCoupon, setApplyWelcomeCoupon] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const { country, currencySymbol } = useCountry();
  const { user, userProfile, isAdmin } = useAuth();

  // Cargar carrito de localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Error reading cart from localStorage", e);
    }
    setInitialized(true);
  }, []);

  // Guardar carrito en localStorage
  useEffect(() => {
    if (!initialized) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error("Error saving cart to localStorage", e);
    }
  }, [items, initialized]);

  const currencyCode: "GTQ" | "USD" = country === "GT" ? "GTQ" : "USD";

  const getItemUnitPrice = (item: CartItem): number => {
    if (country === "GT") {
      return item.priceGTQ;
    }
    if (item.priceUSD != null && item.priceUSD > 0) {
      return item.priceUSD;
    }
    return convertGTQtoUSD(item.priceGTQ);
  };

  const addToCart = (product: any, quantity: number = 1) => {
    const rawStock = product.stock !== undefined ? Number(product.stock) : 99;
    if (rawStock <= 0) {
      alert(`El producto "${product.name}" está actualmente agotado en inventario.`);
      return;
    }

    setItems(prev => {
      const existingIndex = prev.findIndex(item => item.id === product.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        const currentQty = updated[existingIndex].quantity;
        const availableStock = updated[existingIndex].stock ?? rawStock;
        const targetQty = currentQty + quantity;

        if (targetQty > availableStock) {
          alert(`Solo quedan ${availableStock} unidades disponibles de "${product.name}". Se ajustó tu bolsa al límite disponible.`);
          updated[existingIndex].quantity = availableStock;
          updated[existingIndex].stock = availableStock;
          return updated;
        }

        updated[existingIndex].quantity = targetQty;
        updated[existingIndex].stock = availableStock;
        return updated;
      }

      const initialQty = Math.min(Math.max(1, quantity), rawStock);
      if (quantity > rawStock) {
        alert(`Solo quedan ${rawStock} unidades disponibles de "${product.name}". Se añadieron ${rawStock} unidades a tu bolsa.`);
      }

      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          brand: product.brand || product.category || "Liliana Salon",
          category: product.category,
          volume: product.volume,
          priceGTQ: product.price,
          priceUSD: product.priceUSD ?? null,
          image: product.image,
          quantity: initialQty,
          stock: rawStock
        }
      ];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId: string) => {
    setItems(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems(prev =>
      prev.map(item => {
        if (item.id !== productId) return item;
        const maxStock = item.stock !== undefined ? item.stock : 99;
        if (quantity > maxStock) {
          alert(`Has alcanzado el límite de inventario. Solo hay ${maxStock} unidades disponibles de "${item.name}".`);
          return { ...item, quantity: maxStock };
        }
        return { ...item, quantity };
      })
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  // Subtotal oficial
  const subtotal = roundToCommercialPrice(
    items.reduce((sum, item) => sum + getItemUnitPrice(item) * item.quantity, 0)
  );

  // Descuento al por mayor o por docena (12+ unidades en total o 12+ de un producto específico)
  const isWholesaleDiscountApplied = totalItems >= 12 || items.some(item => item.quantity >= 12);
  const wholesaleDiscountPercent = 10;
  const wholesaleDiscount = isWholesaleDiscountApplied
    ? roundToCommercialPrice(subtotal * (wholesaleDiscountPercent / 100))
    : 0;
  const unitsNeededForWholesale = Math.max(0, 12 - totalItems);

  // Regla del cupón de bienvenida: solo aplica si el usuario no es admin y no lo ha usado antes
  const canApplyWelcomeCoupon = Boolean(!isAdmin && userProfile && !userProfile.firstPurchaseUsed && items.length > 0);

  // Encontrar el producto más valioso para aplicar el 15% estrictamente a 1 unidad
  let couponDiscountItem: CartItem | null = null;
  let discount = 0;

  if (canApplyWelcomeCoupon && applyWelcomeCoupon && items.length > 0) {
    let highestPrice = 0;
    for (const it of items) {
      const p = getItemUnitPrice(it);
      if (p > highestPrice) {
        highestPrice = p;
        couponDiscountItem = it;
      }
    }
    if (highestPrice > 0) {
      discount = roundToCommercialPrice(highestPrice * 0.15);
    }
  }

  const total = roundToCommercialPrice(Math.max(0, subtotal - wholesaleDiscount - discount));

  // Puntos ganados con la compra (Admin no acumula puntos)
  const pointsToEarn = isAdmin ? 0 : (country === "GT"
    ? Math.floor(total / 10)
    : Math.floor(total / 1.25));

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        totalItems,
        subtotal,
        discount,
        wholesaleDiscount,
        isWholesaleDiscountApplied,
        unitsNeededForWholesale,
        wholesaleDiscountPercent,
        total,
        pointsToEarn,
        applyWelcomeCoupon,
        setApplyWelcomeCoupon,
        canApplyWelcomeCoupon,
        couponDiscountItem,
        currencySymbol,
        currencyCode,
        getItemUnitPrice
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
