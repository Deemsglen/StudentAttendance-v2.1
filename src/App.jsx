import { useEffect, useState } from "react";
import {
  Link,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as NativeApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { useAuth } from "./context/AuthContext";
import { AttendanceProvider } from "./context/AttendanceContext";
import AppHeader from "./components/AppHeader";
import BottomNavigation from "./components/BottomNavigation";
import Sidebar from "./components/Sidebar";
import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AttendanceHistory from "./pages/AttendanceHistory";
import QRScannerPage from "./pages/QRScannerPage";
import Schedule from "./pages/Schedule";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import TeacherWorkspace from "./pages/TeacherWorkspace";
import TeacherClass from "./pages/TeacherClass";
import Settings from "./pages/Settings";
import LoadingState from "./components/LoadingState";
import { useAttendance } from "./context/AttendanceContext";
function StudentApp() {
  const [menu, setMenu] = useState(false);
  const { dataError, loading: loadingData } = useAttendance();
  const { accountError, user } = useAuth();
  const navigate = useNavigate(),
    location = useLocation();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handler,
      disposed = false;
    NativeApp.addListener("backButton", () => {
      if (menu) {
        setMenu(false);
        return;
      }
      if (location.pathname === "/dashboard") {
        NativeApp.exitApp();
      } else navigate("/dashboard", { replace: true });
    }).then((h) => {
      if (disposed) h.remove();
      else handler = h;
    });
    return () => {
      disposed = true;
      handler?.remove();
    };
  }, [navigate, menu, location.pathname]);
  return (
    <div className="app-shell">
      <AppHeader onMenu={() => setMenu(true)} />
      <main className="main-content" key={location.pathname}>
        {dataError && (
          <p className="error" role="alert">
            {dataError}
          </p>
        )}
        {accountError && (
          <p className="error" role="alert">
            {accountError}
          </p>
        )}
        {!user.course && (
          <Link to="/profile" className="notice">
            Complete your student profile →
          </Link>
        )}
        {loadingData && <LoadingState message="Loading your account data…" />}
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/history" element={<AttendanceHistory />} />
          <Route path="/scan" element={<QRScannerPage />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/teacher" element={<TeacherWorkspace />} />
          <Route path="/teacher/classes/:classId" element={<TeacherClass />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
      <BottomNavigation />
      <Sidebar open={menu} onClose={() => setMenu(false)} />
    </div>
  );
}
export default function App() {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    }
  }, []);
  if (loading)
    return (
      <div className="auth-page">
        <LoadingState message="Restoring your session…" />
      </div>
    );
  return user ? (
    <AttendanceProvider key={user.id}>
      <StudentApp />
    </AttendanceProvider>
  ) : (
    <Routes>
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Navigate to="/welcome" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
