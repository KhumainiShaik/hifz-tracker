import { initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};
export const firebaseConfigured = Object.values(config).every(
  (v) => typeof v === "string" && v.trim().length > 0,
);
export const OWNER_UID = (import.meta.env.VITE_OWNER_UID ?? "").trim();
const emulator =
  import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === "true";
export const firebaseApp = firebaseConfigured ? initializeApp(config) : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
if (auth && emulator)
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
let db: Firestore | null = null;
let persistentOwnerCache = false;
export function database(owner = false): Firestore {
  if (!firebaseApp) throw new Error("Firebase has not been configured.");
  if (db && persistentOwnerCache !== owner) {
    throw new Error(
      "The signed-in account changed. Sign out and sign in again to start a fresh data session.",
    );
  }
  if (!db) {
    persistentOwnerCache = owner;
    db = initializeFirestore(firebaseApp, {
      localCache: owner
        ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        : memoryLocalCache(),
      ignoreUndefinedProperties: false,
    });
    if (emulator) connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  return db;
}
export async function googleSignIn() {
  if (!auth) throw new Error("Configure Firebase first.");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(auth, provider);
}
export async function logOut() {
  if (auth) await signOut(auth);
  if (db) {
    await terminate(db);
    try {
      await clearIndexedDbPersistence(db);
    } catch {
      /* Other open tabs can keep IndexedDB locked. Memory/UI are still cleared on sign-out. */
    }
    db = null;
  }
  window.location.reload();
}
export function friendlyError(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  if (code.includes("permission-denied"))
    return "Access was denied. Check your invitation or the deployed owner UID and security rules.";
  if (code === "auth/popup-blocked")
    return "Your browser blocked Google sign-in. Allow popups for this site and try again.";
  if (code === "auth/popup-closed-by-user")
    return "Google sign-in was closed. You can try again when ready.";
  if (code === "auth/unauthorized-domain")
    return "Add this website domain to Firebase Authentication’s authorized domains.";
  if (code.includes("network") || code.includes("unavailable"))
    return "The server could not be reached. Check your connection and try again.";
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
