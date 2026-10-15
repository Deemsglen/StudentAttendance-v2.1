import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PasswordField from "../components/PasswordField";
import BackendNotice from "../components/BackendNotice";
import { backendReady, friendlyError } from "../services/firebase";
export default function Register() {
  const { register } = useAuth(),
    navigate = useNavigate(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  async function submit(e) {
    e.preventDefault();
    setError("");
    const v = Object.fromEntries(new FormData(e.currentTarget));
    for (const k of ["name", "studentId", "email", "course"])
      v[k] = v[k].trim();
    if (!v.name || !v.studentId || !v.course)
      return setError("Complete your student information.");
    if (password.length < 12)
      return setError("Use at least 12 characters for your password.");
    if (password !== confirm) return setError("Passwords do not match.");
    delete v.confirm;
    setBusy(true);
    try {
      await register(v);
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <Link to="/login">← Back to login</Link>
      <h1>
        Your schedule.
        <br />
        Made personal.
      </h1>
      <p className="muted">
        Create your student account. Your schedule starts empty—you choose your
        own subjects.
      </p>
      <BackendNotice />
      <form onSubmit={submit}>
        {[
          ["name", "Full name", "text"],
          ["studentId", "Student ID", "text"],
          ["email", "Email", "email"],
          ["course", "Course", "text"],
        ].map(([name, label, type]) => (
          <label key={name}>
            {label}
            <input required name={name} type={type} maxLength={100} />
          </label>
        ))}
        <label>
          Year level
          <select name="year">
            {[1, 2, 3, 4, 5].map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        </label>
        <PasswordField
          name="password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={12}
          autoComplete="new-password"
        />
        <PasswordField
          name="confirm"
          label="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={12}
          autoComplete="new-password"
        />
        <p className="notice">
          A verification email will be sent after registration. Confirm your
          email before recording attendance.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button full" disabled={busy || !backendReady}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
