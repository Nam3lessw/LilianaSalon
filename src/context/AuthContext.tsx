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
  serverTimestamp 
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: "admin" | "customer";
  points: number;
  welcomeCoupon: string | null;
  firstPurchaseUsed: boolean;
  country?: "GT" | "SV";
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
  const [isAdmin, setIsAdmin] = useState(false);
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

      if (currentUser) {
        try {
          // Cryptographically verify custom claims via Firebase Auth ID Token
          const tokenResult = await currentUser.getIdTokenResult();
          const hasAdminClaim = Boolean(tokenResult.claims.admin);
          setIsAdmin(hasAdminClaim);

          if (db) {
            const userDocRef = doc(db, "users", currentUser.uid);
            const docSnap = await getDoc(userDocRef);

            if (docSnap.exists()) {
              setUserProfile(docSnap.data() as UserProfile);
            } else {
              // Create default profile for the user
              const newProfile: UserProfile = {
                uid: currentUser.uid,
                name: currentUser.displayName || currentUser.email?.split("@")[0] || "Cliente",
                email: currentUser.email || "",
                role: hasAdminClaim ? "admin" : "customer",
                points: hasAdminClaim ? 0 : 50,
                welcomeCoupon: hasAdminClaim ? null : "BIENVENIDA15",
                firstPurchaseUsed: hasAdminClaim ? true : false,
                createdAt: serverTimestamp()
              };

              await setDoc(userDocRef, newProfile);
              setUserProfile(newProfile);
            }
          }
        } catch (err) {
          console.error("Error loading user profile and claims:", err);
          setIsAdmin(false);
        }
      } else {
        setUserProfile(null);
        setIsAdmin(false);
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
    setUser(null);
    setUserProfile(null);
    setIsAdmin(false);
    setCustomerDrawerOpen(false);
  };

  const refreshProfile = async () => {
    if (user) {
      try {
        const tokenResult = await user.getIdTokenResult(true);
        setIsAdmin(Boolean(tokenResult.claims.admin));

        if (db) {
          const docSnap = await getDoc(doc(db, "users", user.uid));
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          }
        }
      } catch (e) {
        console.error("Error refreshing user profile:", e);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        isAdmin,
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
