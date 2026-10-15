import { createContext, useContext, useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  writeBatch,
  deleteDoc,
} from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { db, apiUrl, friendlyError } from "../services/firebase";
import { validateSubject } from "../utils/schedule";
import { parseAttendanceQR } from "../utils/attendance";
const Context = createContext();
export function AttendanceProvider({ children }) {
  const { user } = useAuth(),
    uid = user.id;
  const [records, setRecords] = useState([]),
    [subjects, setSubjects] = useState([]),
    [notifications, setNotifications] = useState([]),
    [settings, setSettings] = useState({
      notifications: true,
      theme: "system",
    }),
    [dataError, setDataError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const fail = (e) => {
      setDataError(friendlyError(e));
      setLoading(false);
    };
    const stops = [
      onSnapshot(
        collection(db, "users", uid, "attendance"),
        (s) => {
          setRecords(
            s.docs
              .map((d) => ({ ...d.data(), id: d.id }))
              .sort((a, b) =>
                `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`),
              ),
          );
          setLoading(false);
          setDataError("");
        },
        fail,
      ),
      onSnapshot(
        collection(db, "users", uid, "subjects"),
        (s) => setSubjects(s.docs.map((d) => ({ ...d.data(), id: d.id }))),
        fail,
      ),
      onSnapshot(
        collection(db, "users", uid, "notifications"),
        (s) =>
          setNotifications(
            s.docs
              .map((d) => ({ ...d.data(), id: d.id }))
              .sort(
                (a, b) =>
                  (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
              ),
          ),
        fail,
      ),
      onSnapshot(
        doc(db, "users", uid),
        (s) =>
          setSettings({
            notifications: true,
            theme: "system",
            ...(s.data()?.settings || {}),
          }),
        fail,
      ),
    ];
    return () => stops.forEach((stop) => stop());
  }, [uid]);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        settings.theme === "system"
          ? mq.matches
            ? "dark"
            : "light"
          : settings.theme);
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      delete document.documentElement.dataset.theme;
    };
  }, [settings.theme]);
  async function scan(raw) {
    const payload = parseAttendanceQR(raw);
    const user = (await import("../services/firebase")).auth.currentUser;
    if (!user) throw { code: "functions/unauthenticated" };
    const token = await user.getIdToken();
    const res = await fetch(`${apiUrl}/api/markAttendance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.message || "Request failed");
      err.code = `functions/${data.error || res.status}`;
      throw err;
    }
    return data;
  }
  async function saveSubjects(rows) {
    if (!rows.length || rows.length > 100)
      throw new Error("Confirm between 1 and 100 subjects at a time.");
    const clean = rows.map(validateSubject);
    const merged = [
      ...subjects.filter((s) => !rows.some((r) => r.id === s.id)),
      ...clean,
    ];
    for (let i = 0; i < merged.length; i++)
      for (let j = i + 1; j < merged.length; j++) {
        const a = merged[i],
          b = merged[j];
        if (a.day === b.day && a.time < b.end && b.time < a.end)
          throw new Error(
            `Schedule conflict: ${a.subject} and ${b.subject}. Check their days and times.`,
          );
      }
    const batch = writeBatch(db);
    for (const row of clean) {
      const reference = row.id
        ? doc(db, "users", uid, "subjects", row.id)
        : doc(collection(db, "users", uid, "subjects"));
      const { id, ...data } = row;
      batch.set(reference, data);
    }
    await batch.commit();
  }
  async function deleteSubject(id) {
    await deleteDoc(doc(db, "users", uid, "subjects", id));
  }
  async function markRead(id) {
    const batch = writeBatch(db);
    for (const n of notifications
      .filter((n) => !n.read && (id === "all" || n.id === id))
      .slice(0, 400))
      batch.update(doc(db, "users", uid, "notifications", n.id), {
        read: true,
      });
    await batch.commit();
  }
  async function saveSettings(next) {
    await setDoc(
      doc(db, "users", uid),
      {
        settings: {
          notifications: !!next.notifications,
          theme: ["light", "dark", "system"].includes(next.theme)
            ? next.theme
            : "system",
        },
      },
      { merge: true },
    );
  }
  return (
    <Context.Provider
      value={{
        records,
        subjects,
        notifications,
        settings,
        dataError,
        loading,
        scan,
        saveSubjects,
        deleteSubject,
        markRead,
        saveSettings,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAttendance = () => useContext(Context);
