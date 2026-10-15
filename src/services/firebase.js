import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const backendReady = Object.values(config).every(
  (v) => typeof v === "string" && v.trim(),
);
export const firebaseApp = backendReady ? initializeApp(config) : null;
export const auth = backendReady ? getAuth(firebaseApp) : null;
export const db = backendReady ? getFirestore(firebaseApp) : null;
export const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
export const usingEmulators =
  import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === "true";
if (usingEmulators && backendReady) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
export function requireBackend() {
  if (!backendReady)
    throw new Error(
      "Account service is not configured yet. Follow FIREBASE_SETUP.md and rebuild this app. No account was created.",
    );
}
export function friendlyError(error) {
  const messages = {
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/email-already-in-use":
      "An account already uses this email. Try signing in or resetting your password.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password":
      "Choose a stronger password with at least 12 characters.",
    "auth/network-request-failed":
      "Cannot connect. Check your internet connection and try again.",
    "auth/too-many-requests":
      "Too many attempts. Please wait before trying again.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/popup-blocked": "Allow the sign-in popup, then try again.",
    "auth/requires-recent-login":
      "Please sign out and sign in again before changing your password.",
    "permission-denied":
      "Access denied. Check your account and the deployed Firestore rules.",
    "functions/not-found":
      "Attendance service is not deployed yet. Ask your school administrator.",
    "functions/unauthenticated": "Please sign in again to verify attendance.",
  };
  return (
    messages[error?.code] ||
    error?.message ||
    "Unable to complete the request. Please try again."
  );
}
