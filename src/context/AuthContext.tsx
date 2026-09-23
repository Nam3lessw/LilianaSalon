"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  User, 
  onAuthStateChanged, 
  signOut as firebaseSignOut 
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp, 
  onSnapshot 
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: "admin" | "customer";
  points: number;
  welcomeCoupon: string;
  firstPurchaseUsed: boolean;
  createdAt?: any;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  authModalOpen: boolean;
  authModalTab: "login" | "register";
  customerDrawerOpen: boolean;
  openAuthModal: (tab?: "login" | "register") => void;
  closeAuthModal: () => void;
  setCustomerDrawerOpen: (open: boolean) => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  isAdmin: false,
  loading: true,
  authModalOpen: false,
  authModalTab: "login",
  customerDrawerOpen: false,
  openAuthModal: () => {},
  closeAuthModal: () => {},
  setCustomerDrawerOpen: () => {},
  logout: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<"login" | "register">("login");
  const [customerDrawerOpen, setCustomerDrawerOpen] = useState(false);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && db) {
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(userDocRef);

          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            // Check if this is the admin account or customer
            const isPotentialAdmin = 
              currentUser.email?.toLowerCase().includes("admin") ||
              currentUser.email?.toLowerCase().includes("liliana");

            const newProfile: UserProfile = {
              uid: currentUser.uid,
              name: currentUser.displayName || currentUser.email?.split("@")[0] || "Cliente",
              email: currentUser.email || "",
              role: isPotentialAdmin ? "admin" : "customer",
              points: isPotentialAdmin ? 0 : 50, // 50 puntos de bienvenida para clientes
              welcomeCoupon: "BIENVENIDA15",
              firstPurchaseUsed: false,
              createdAt: serverTimestamp()
            };

            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);
          }
        } catch (err) {
          console.error("Error loading user profile:", err);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openAuthModal = (tab: "login" | "register" = "login") => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  const logout = async () => {
    if (auth) {
      await firebaseSignOut(auth);
    }
    sessionStorage.removeItem("mockAuth");
    setUser(null);
    setUserProfile(null);
    setCustomerDrawerOpen(false);
  };

  const refreshProfile = async () => {
    if (user && db) {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      }
    }
  };

  // Determine if admin
  const isAdmin = 
    userProfile?.role === "admin" || 
    user?.email?.toLowerCase().includes("admin") ||
    user?.email?.toLowerCase().includes("liliana") ||
    (typeof window !== "undefined" && sessionStorage.getItem("mockAuth") === "true");

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        isAdmin: !!isAdmin,
        loading,
        authModalOpen,
        authModalTab,
        customerDrawerOpen,
        openAuthModal,
        closeAuthModal,
        setCustomerDrawerOpen,
        logout,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
