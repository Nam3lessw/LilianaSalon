import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAZT4swt72PWmmNK4iPS1wKjl1A-I9_nRc",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "liliana-salon.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "liliana-salon",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "liliana-salon.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "570754067993",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:570754067993:web:d376ea3cb0346da177c488",
};

export const app = (!getApps().length ? initializeApp(firebaseConfig) : getApp());

export const auth: Auth | null = app ? getAuth(app) : null;
export const db: Firestore | null = app ? getFirestore(app) : null;
export const storage: FirebaseStorage | null = app ? getStorage(app) : null;

// Initialize Firebase App Check in client browser environment if configured
if (typeof window !== "undefined" && app) {
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (recaptchaSiteKey) {
    try {
      // In development mode, allow debug token if configured
      if (process.env.NODE_ENV === "development") {
        (globalThis as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
          process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN || true;
      }
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (e) {
      console.warn("Firebase App Check initialization skipped:", e);
    }
  }
}
