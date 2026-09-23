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
  const { user, userProfile } = useAuth();

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
    setItems(prev => {
      const existingIndex = prev.findIndex(item => item.id === product.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        return updated;
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
          quantity: Math.max(1, quantity)
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
      prev.map(item => (item.id === productId ? { ...item, quantity } : item))
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

  // Regla del cupón: solo aplica si el usuario no lo ha usado antes
  const canApplyWelcomeCoupon = Boolean(userProfile && !userProfile.firstPurchaseUsed && items.length > 0);

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

  const total = roundToCommercialPrice(Math.max(0, subtotal - discount));

  // Puntos ganados con la compra
  const pointsToEarn = country === "GT"
    ? Math.floor(total / 10)
    : Math.floor(total / 1.25);

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
