import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import PasswordField from "../components/PasswordField";
import BackendNotice from "../components/BackendNotice";
import { backendReady, friendlyError } from "../services/firebase";
export default function Login() {
  const { login, googleLogin, resetPassword } = useAuth(),
    navigate = useNavigate();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [forgot, setForgot] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function run(action) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <Link to="/welcome" className="text-link">
        <ArrowLeft size={18} />
        Back
      </Link>
      <img className="auth-logo" src="/logo.svg" alt="Student Attendance" />
      <span className="eyebrow">WELCOME BACK</span>
      <h1>
        Your classes.
        <br />
        Your own journey.
      </h1>
      <p className="muted">
        Sign in securely with your email or Google account.
      </p>
      <BackendNotice />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await login(email, password);
            navigate("/dashboard", { replace: true });
          });
        }}
      >
        <label>
          Email
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <PasswordField
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="button"
          className="text-button right"
          onClick={() => setForgot(!forgot)}
        >
          Forgot password?
        </button>
        {forgot && (
          <div className="notice">
            <p>
              Enter your email above. We will request a reset email without
              revealing whether an account exists.
            </p>
            <button
              type="button"
              disabled={busy || !backendReady}
              className="text-button"
              onClick={() => {
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                  return setError("Enter a valid email first.");
                run(async () => {
                  await resetPassword(email);
                  setMessage(
                    "If an account exists for that email, a reset link will be sent. Check your inbox and spam folder.",
                  );
                });
              }}
            >
              Send password reset link
            </button>
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="success" role="status">
            {message}
          </p>
        )}
        <button className="button full" disabled={busy || !backendReady}>
          {busy ? "Please wait…" : "Log in"}
        </button>
      </form>
      <div className="auth-divider">or</div>
      <button
        className="button google-button full"
        disabled={busy || !backendReady}
        onClick={() =>
          run(async () => {
            await googleLogin();
            navigate("/dashboard", { replace: true });
          })
        }
      >
        <span aria-hidden="true" className="google-mark">
          G
        </span>
        Continue with Google
      </button>
      <p className="center auth-footer">
        New here? <Link to="/register">Create an account</Link>
      </p>
      <p className="muted">
        Your password is handled by Firebase Authentication, never saved in this
        app's LocalStorage.
      </p>
    </div>
  );
}
