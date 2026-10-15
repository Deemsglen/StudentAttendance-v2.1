import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, BookOpen, RefreshCw, ShieldCheck } from "lucide-react";
import ManagementAccess from "../components/ManagementAccess";
import ConfirmDialog from "../components/ConfirmDialog";
import LoadingState from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";
import { managementCall } from "../services/management";
import { validateClass } from "../utils/management";
function Workspace() {
  const { role } = useAuth();
  const [classes, setClasses] = useState([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [showForm, setShowForm] = useState(false),
    [draft, setDraft] = useState({ subject: "", code: "", room: "" }),
    [pending, setPending] = useState(null);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await managementCall("listManagedClasses");
      if (!Array.isArray(data.classes))
        throw new Error("Invalid class list response.");
      setClasses(data.classes);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  function submit(e) {
    e.preventDefault();
    setError("");
    try {
      setPending({ ...validateClass(draft), requestId: crypto.randomUUID() });
    } catch (e) {
      setError(e.message);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      const data = await managementCall("createClass", pending);
      if (!data.class?.id || !data.class.subject)
        throw new Error(
          "No confirmed class returned. Refresh the list before retrying.",
        );
      setPending(null);
      setShowForm(false);
      setDraft({ subject: "", code: "", room: "" });
      setMessage("Class created by the school service.");
      await load();
    } catch (e) {
      setError(e.message);
      setPending(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-title">
        <span className="eyebrow">SCHOOL WORKSPACE · {role.toUpperCase()}</span>
        <h1>Classes & check-ins</h1>
        <p className="muted">
          Manage enrollment. Open a session. Let students scan.
        </p>
      </div>
      <p className="notice management-note">
        <ShieldCheck size={22} />
        <span>
          Only the school backend can issue attendance QR codes. These screens
          need the callable services described in CODEX_BACKEND_PROMPT.md.
        </span>
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <div className="management-actions">
        <button
          className="button"
          disabled={busy}
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={20} />
          {showForm ? "Close form" : "Create class"}
        </button>
        <button
          className="button secondary"
          disabled={busy || loading}
          onClick={load}
        >
          <RefreshCw size={18} /> Refresh
        </button>
      </div>
      {showForm && (
        <form className="panel" onSubmit={submit}>
          <h2>A new class</h2>
          {[
            ["subject", "Subject name", 120],
            ["code", "Class / section code", 40],
            ["room", "Room (optional)", 120],
          ].map(([key, label, max]) => (
            <label key={key}>
              {label}
              <input
                required={key !== "room"}
                maxLength={max}
                value={draft[key]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            </label>
          ))}
          <button className="button" disabled={busy}>
            Review & create
          </button>
        </form>
      )}
      {loading ? (
        <LoadingState message="Loading school classes…" />
      ) : classes.length ? (
        <div className="class-list">
          {classes.map((item) => (
            <Link
              className="panel managed-class"
              key={item.id}
              to={`/teacher/classes/${encodeURIComponent(item.id)}`}
            >
              <span className="icon-tile">
                <BookOpen />
              </span>
              <div>
                <h2>{item.subject}</h2>
                <p className="muted">
                  {item.code} · {item.room || "Room not assigned"}
                </p>
                <p className="muted">Manage students & attendance →</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        !error && (
          <section className="panel empty">
            <BookOpen size={36} />
            <h2>No managed classes yet</h2>
            <p className="muted">
              Create your first class. Student personal timetables stay
              separate.
            </p>
          </section>
        )
      )}
      <ConfirmDialog
        open={!!pending}
        title="Create this class?"
        message={
          pending
            ? `${pending.subject} · ${pending.code}. You will manage enrollment for this class.`
            : ""
        }
        busy={busy}
        confirmLabel="Confirm & create"
        onCancel={() => setPending(null)}
        onConfirm={save}
      />
    </>
  );
}
export default function TeacherWorkspace() {
  return (
    <ManagementAccess>
      <Workspace />
    </ManagementAccess>
  );
}
