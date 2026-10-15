import { Sun, Moon, Monitor, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAttendance } from "../context/AttendanceContext";
import { useAuth } from "../context/AuthContext";
import PasswordField from "../components/PasswordField";
import { friendlyError } from "../services/firebase";
export default function Settings() {
  const { settings, saveSettings } = useAttendance(),
    { user, changePassword, role, refreshAccess } = useAuth(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [current, setCurrent] = useState(""),
    [next, setNext] = useState(""),
    [confirm, setConfirm] = useState("");
  async function run(fn) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  async function password(e) {
    e.preventDefault();
    if (next !== confirm) return setMessage("New passwords do not match.");
    await run(async () => {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setMessage("Password changed successfully.");
    });
  }
  return (
    <>
      <div className="page-title">
        <span className="eyebrow">MAKE IT YOURS</span>
        <h1>Settings</h1>
        <p className="muted">Your account, your preferences.</p>
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <section className="panel">
        <h2>Preferences</h2>
        <label className="toggle-label">
          <span>
            <strong>Attendance confirmations</strong>
            <small>In-app messages. No background push.</small>
          </span>
          <input
            type="checkbox"
            checked={settings.notifications}
            disabled={busy}
            onChange={(e) =>
              run(async () => {
                await saveSettings({
                  ...settings,
                  notifications: e.target.checked,
                });
                setMessage("Preference saved.");
              })
            }
          />
        </label>
        <div className="appearance-controls">
          <h3>Appearance</h3>
          <div className="theme-buttons" role="group" aria-label="Appearance">
            {[
              ["light", "Light", Sun],
              ["dark", "Dark", Moon],
              ["system", "System", Monitor],
            ].map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={settings.theme === value}
                className={`theme-choice ${settings.theme === value ? "selected" : ""}`}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await saveSettings({ ...settings, theme: value });
                    setMessage(`${label} appearance saved.`);
                  })
                }
              >
                <Icon size={20} />
                <strong>{label}</strong>
                <small>
                  {value === "dark"
                    ? "Dark ON"
                    : value === "light"
                      ? "Dark OFF"
                      : "Auto"}
                </small>
              </button>
            ))}
          </div>
          <p className="muted">
            Light turns dark mode off. Dark turns it on. System follows your
            device.
          </p>
        </div>
      </section>
      <section className="panel">
        <h2>Account</h2>
        <p className="muted">
          Access: {role}. Teacher access is assigned by your school, never by
          registration.
        </p>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await refreshAccess();
              setMessage("Account access refreshed.");
            })
          }
        >
          <ShieldCheck size={18} /> Refresh account access
        </button>
        <Link className="menu-row" to="/profile">
          Edit profile and photo →
        </Link>
        {user.hasPassword ? (
          <details>
            <summary>Change password</summary>
            <form onSubmit={password}>
              <PasswordField
                label="Current password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
              <PasswordField
                label="New password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                minLength={12}
                autoComplete="new-password"
              />
              <PasswordField
                label="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={12}
                autoComplete="new-password"
              />
              <button className="button secondary" disabled={busy}>
                {busy ? "Updating…" : "Update password"}
              </button>
            </form>
          </details>
        ) : (
          <p className="notice">
            You sign in with Google. Manage your Google password through your
            Google account, not this app.
          </p>
        )}
      </section>
      <section className="panel">
        <img src="/logo.svg" width="48" height="48" alt="" />
        <h2>Student Attendance</h2>
        <p>Version 2.1.0 · Your personal campus companion</p>
        <p className="muted">
          Firebase account authentication and account-scoped schedules.
          Attendance can only be recorded using a valid school-issued QR and a
          deployed verification service.
        </p>
        <p className="notice">
          Personal schedules are self-managed, not proof of enrollment. OCR
          suggestions must be reviewed. Google login and school attendance
          verification require the project owner's backend setup. Never share
          your password.
        </p>
      </section>
    </>
  );
}
