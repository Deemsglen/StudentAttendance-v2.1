import { createContext, useContext, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import {
  onAuthStateChanged,
  onIdTokenChanged,
  getIdTokenResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  updateProfile as updateAuthProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import {
  auth,
  db,
  backendReady,
  requireBackend,
  friendlyError,
} from "../services/firebase";
import { accessRole } from "../utils/management";
const Context = createContext();
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(backendReady),
    [accountError, setAccountError] = useState("");
  const [claims, setClaims] = useState({}),
    [roleLoading, setRoleLoading] = useState(backendReady);
  useEffect(() => {
    if (!backendReady) return;
    let alive = true,
      generation = 0;
    const stop = onIdTokenChanged(auth, async (account) => {
      const current = ++generation;
      setClaims({});
      setRoleLoading(!!account);
      if (!account) return;
      try {
        const result = await getIdTokenResult(account);
        if (
          alive &&
          current === generation &&
          auth.currentUser?.uid === account.uid
        )
          setClaims(result.claims);
      } catch (e) {
        if (alive && current === generation) setAccountError(friendlyError(e));
      } finally {
        if (alive && current === generation) setRoleLoading(false);
      }
    });
    return () => {
      alive = false;
      generation++;
      stop();
    };
  }, []);
  async function refreshAccess() {
    requireBackend();
    if (!auth.currentUser) throw new Error("Sign in again first.");
    await auth.currentUser.getIdToken(true);
  }
  const role = accessRole(claims),
    canManageClasses = role === "teacher" || role === "admin";
  useEffect(() => {
    if (!backendReady) return;
    let stopProfile = () => {};
    const stop = onAuthStateChanged(auth, (account) => {
      stopProfile();
      setAccountError("");
      if (!account) {
        setUser(null);
        setLoading(false);
        return;
      }
      const base = {
        id: account.uid,
        name: account.displayName || "Student",
        email: account.email || "",
        studentId: "",
        course: "",
        year: "1",
        avatar: account.photoURL || "",
        emailVerified: account.emailVerified,
        hasPassword: account.providerData.some(
          (p) => p.providerId === "password",
        ),
      };
      setUser(base);
      setLoading(false);
      stopProfile = onSnapshot(
        doc(db, "users", account.uid),
        (snap) => {
          setUser({
            ...base,
            ...(snap.data() || {}),
            id: account.uid,
            email: account.email,
            emailVerified:
              auth.currentUser?.emailVerified ?? account.emailVerified,
            hasPassword: base.hasPassword,
          });
        },
        (e) => setAccountError(friendlyError(e)),
      );
    });
    return () => {
      stop();
      stopProfile();
    };
  }, []);
  async function login(email, password) {
    requireBackend();
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }
  async function register(values) {
    requireBackend();
    const { user: account } = await createUserWithEmailAndPassword(
      auth,
      values.email.trim(),
      values.password,
    );
    await updateAuthProfile(account, { displayName: values.name.trim() });
    await setDoc(
      doc(db, "users", account.uid),
      {
        name: values.name.trim(),
        studentId: values.studentId.trim(),
        course: values.course.trim(),
        year: values.year,
        email: account.email,
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
    try {
      await sendEmailVerification(account);
    } catch (e) {
      setAccountError(
        `Account created, but verification email could not be sent: ${friendlyError(e)}`,
      );
    }
  }
  async function googleLogin() {
    requireBackend();
    let account;
    if (Capacitor.isNativePlatform()) {
      if (import.meta.env.VITE_NATIVE_GOOGLE_ENABLED !== "true")
        throw new Error(
          "Android Google sign-in needs google-services.json, registered SHA fingerprints and a rebuilt APK. See FIREBASE_SETUP.md.",
        );
      const result = await FirebaseAuthentication.signInWithGoogle({
        skipNativeAuth: true,
      });
      const token = result.credential?.idToken;
      if (!token)
        throw new Error(
          "Google did not return an identity token. Please try again.",
        );
      account = (
        await signInWithCredential(auth, GoogleAuthProvider.credential(token))
      ).user;
    } else {
      account = (await signInWithPopup(auth, new GoogleAuthProvider())).user;
    }
    await setDoc(
      doc(db, "users", account.uid),
      { email: account.email },
      { merge: true },
    );
  }
  async function updateProfile(values) {
    requireBackend();
    if (!auth.currentUser) throw new Error("Please sign in first.");
    const allowed = {};
    for (const field of ["name", "studentId", "course", "year", "avatar"])
      if (field in values) allowed[field] = values[field];
    await setDoc(doc(db, "users", auth.currentUser.uid), allowed, {
      merge: true,
    });
    if (allowed.name)
      await updateAuthProfile(auth.currentUser, { displayName: allowed.name });
  }
  async function logout() {
    await signOut(auth);
    if (Capacitor.isNativePlatform()) {
      try {
        await FirebaseAuthentication.signOut();
      } catch {
        /* JS Firebase session has already ended. */
      }
    }
  }
  async function resetPassword(email) {
    requireBackend();
    await sendPasswordResetEmail(auth, email.trim());
  }
  async function verifyEmail() {
    requireBackend();
    await sendEmailVerification(auth.currentUser);
  }
  async function refreshVerification() {
    await auth.currentUser?.reload();
    if (auth.currentUser) {
      await auth.currentUser.getIdToken(true);
      setUser((current) => ({
        ...current,
        emailVerified: auth.currentUser.emailVerified,
      }));
    }
  }
  async function changePassword(current, next) {
    requireBackend();
    if (!auth.currentUser?.email) throw new Error("Sign in again first.");
    await reauthenticateWithCredential(
      auth.currentUser,
      EmailAuthProvider.credential(auth.currentUser.email, current),
    );
    await updatePassword(auth.currentUser, next);
  }
  return (
    <Context.Provider
      value={{
        user,
        loading,
        accountError,
        role,
        roleLoading,
        canManageClasses,
        refreshAccess,
        login,
        register,
        googleLogin,
        updateProfile,
        logout,
        resetPassword,
        verifyEmail,
        refreshVerification,
        changePassword,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
