import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { UserPlus, QrCode, RefreshCw, Trash2, ArrowLeft } from "lucide-react";
import ManagementAccess from "../components/ManagementAccess";
import ConfirmDialog from "../components/ConfirmDialog";
import LoadingState from "../components/LoadingState";
import AttendanceQRDisplay from "../components/AttendanceQRDisplay";
import { managementCall } from "../services/management";
import { validateSession, validatedQR } from "../utils/management";
function ClassDetail() {
  const { classId } = useParams();
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [email, setEmail] = useState(""),
    [pending, setPending] = useState(null),
    [qr, setQR] = useState(null),
    [studentPage, setStudentPage] = useState(1),
    [sessionPage, setSessionPage] = useState(1),
    [draft, setDraft] = useState({
      startsAt: "",
      lateAfter: "",
      endsAt: "",
      timeZone:
        Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Manila",
    });
  const STUDENTS_PER_PAGE = 10;
  const SESSIONS_PER_PAGE = 5;
  const totalStudents = data?.students?.length || 0;
  const totalStudentPages = Math.max(1, Math.ceil(totalStudents / STUDENTS_PER_PAGE));
  const currentStudentPage = Math.min(studentPage, totalStudentPages);
  const pagedStudents = (data?.students || []).slice(
    (currentStudentPage - 1) * STUDENTS_PER_PAGE,
    currentStudentPage * STUDENTS_PER_PAGE,
  );
  const totalSessions = data?.sessions?.length || 0;
  const totalSessionPages = Math.max(1, Math.ceil(totalSessions / SESSIONS_PER_PAGE));
  const currentSessionPage = Math.min(sessionPage, totalSessionPages);
  const pagedSessions = (data?.sessions || []).slice(
    (currentSessionPage - 1) * SESSIONS_PER_PAGE,
    currentSessionPage * SESSIONS_PER_PAGE,
  );
  async function load() {
    setLoading(true);
    try {
      const next = await managementCall("getManagedClass", { classId });
      if (
        !next.class?.id ||
        !Array.isArray(next.students) ||
        !Array.isArray(next.sessions)
      )
        throw new Error("Invalid class detail response.");
      setData(next);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    return () => setQR(null);
  }, [classId]);
  async function execute() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await managementCall(pending.name, pending.input);
      if (
        ["startAttendanceSession", "rotateAttendanceQR"].includes(pending.name)
      ) {
        validatedQR(result);
        setQR(result);
        setMessage("School-issued QR received.");
      } else if (result.ok !== true)
        throw new Error(
          "The service did not confirm the change. Refresh before retrying.",
        );
      else {
        if (pending.name === "closeAttendanceSession") setQR(null);
        setMessage("Change confirmed by the school service.");
        if (pending.name === "enrollStudent") setEmail("");
      }
      setPending(null);
      await load();
    } catch (e) {
      setError(e.message);
      setPending(null);
    } finally {
      setBusy(false);
    }
  }
  function start(e) {
    e.preventDefault();
    setError("");
    try {
      const input = validateSession(draft);
      setPending({
        name: "startAttendanceSession",
        input: { classId, ...input, requestId: crypto.randomUUID() },
        title: "Open this attendance session?",
        message: `${data.class.subject}. Starts ${new Date(input.startsAt).toLocaleString()}, closes ${new Date(input.endsAt).toLocaleString()}. Times were entered in your device zone (${Intl.DateTimeFormat().resolvedOptions().timeZone}). Record labels use ${input.timeZone}.`,
        label: "Confirm & issue QR",
      });
    } catch (e) {
      setError(e.message);
    }
  }
  function enroll(e) {
    e.preventDefault();
    setPending({
      name: "enrollStudent",
      input: { classId, email: email.trim() },
      title: "Enroll this student?",
      message: `Add ${email.trim()} to ${data.class.subject}? The school service must verify this account.`,
      label: "Confirm enrollment",
    });
  }
  return (
    <>
      <Link className="back-link" to="/teacher">
        <ArrowLeft size={18} /> All classes
      </Link>
      <div className="page-title">
        <span className="eyebrow">CLASS MANAGEMENT</span>
        <h1>{data?.class.subject || "Class details"}</h1>
        <p className="muted">
          {data
            ? `${data.class.code} · ${data.class.room || "No room assigned"}`
            : "Loading your school class."}
        </p>
      </div>
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
      <button
        className="button secondary"
        disabled={busy || loading}
        onClick={() => {
          setError("");
          load();
        }}
      >
        <RefreshCw size={18} />
        Refresh class
      </button>
      {loading && !data && (
        <LoadingState message="Loading enrolled students and sessions…" />
      )}
      {data && (
        <>
          <section className="panel">
            <h2>
              Enrolled students{" "}
              <span className="muted">({data.students.length})</span>
            </h2>
            <p className="muted">
              Use the email of an existing verified student account. Personal
              schedule entries are not enrollments.
            </p>
            <form onSubmit={enroll}>
              <label>
                Student email
                <input
                  type="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <button className="button secondary" disabled={busy}>
                <UserPlus size={18} />
                Add student
              </button>
            </form>
            {!data.students.length && (
              <p className="muted">No students enrolled yet.</p>
            )}
            <ul className="enrollment-list">
              {pagedStudents.map((student) => (
                <li key={student.uid}>
                  <div>
                    <strong>{student.name || student.email}</strong>
                    <p className="muted">{student.email}</p>
                    <small>
                      {student.studentId || "No student ID provided"}
                    </small>
                  </div>
                  <button
                    className="icon-button danger"
                    disabled={busy}
                    aria-label={`Remove ${student.email}`}
                    onClick={() =>
                      setPending({
                        name: "removeStudent",
                        input: { classId, uid: student.uid },
                        title: "Remove enrollment?",
                        message: `Remove ${student.email}? Existing attendance remains saved. This must revoke access to active class sessions.`,
                        label: "Remove student",
                      })
                    }
                  >
                    <Trash2 size={20} />
                  </button>
                </li>
              ))}
            </ul>
            {totalStudentPages > 1 && (
              <div className="management-actions" style={{ marginTop: "1rem", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  type="button"
                  className="button secondary"
                  disabled={currentStudentPage <= 1}
                  onClick={() => setStudentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="muted" style={{ fontSize: "0.85rem" }}>
                  Page {currentStudentPage} of {totalStudentPages} ({totalStudents} students)
                </span>
                <button
                  type="button"
                  className="button secondary"
                  disabled={currentStudentPage >= totalStudentPages}
                  onClick={() => setStudentPage((p) => Math.min(totalStudentPages, p + 1))}
                >
                  Next
                </button>
              </div>
            )}
          </section>
          <form className="panel" onSubmit={start}>
            <h2>Start attendance</h2>
            <p className="muted">
              All three times use your device's local time zone:{" "}
              {Intl.DateTimeFormat().resolvedOptions().timeZone}. The server is
              authoritative.
            </p>
            {[
              ["startsAt", "Session start"],
              ["lateAfter", "Late after"],
              ["endsAt", "Session closes"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="datetime-local"
                  required
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value })
                  }
                />
              </label>
            ))}
            <label>
              Attendance record time zone
              <input
                required
                maxLength={80}
                value={draft.timeZone}
                onChange={(e) =>
                  setDraft({ ...draft, timeZone: e.target.value })
                }
              />
            </label>
            <button className="button" disabled={busy}>
              <QrCode size={20} />
              Review & issue QR
            </button>
          </form>
          {qr && <AttendanceQRDisplay result={qr} />}
          <section className="panel">
            <h2>Attendance sessions</h2>
            <p className="muted">
              QR tokens stay in memory only. After reopening, rotate a session
              QR to display a fresh code.
            </p>
            {!data.sessions.length && <p className="muted">No sessions yet.</p>}
            {pagedSessions.map((session) => (
              <article className="session-row" key={session.id}>
                <strong>{session.subject || data.class.subject}</strong>
                <p className="muted">
                  {new Date(session.startsAt).toLocaleString()} →{" "}
                  {new Date(session.endsAt).toLocaleString()}
                </p>
                <p>
                  {session.closed
                    ? "Closed"
                    : Date.parse(session.endsAt) <= Date.now()
                      ? "Ended"
                      : "Scheduled / open"}
                </p>
                {!session.closed && Date.parse(session.endsAt) > Date.now() && (
                  <div className="management-actions">
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        setPending({
                          name: "rotateAttendanceQR",
                          input: { sessionId: session.id },
                          title: "Replace this QR?",
                          message:
                            "The previous code immediately stops working. Already confirmed attendance is preserved.",
                          label: "Rotate & display QR",
                        })
                      }
                    >
                      <RefreshCw size={18} />
                      New QR
                    </button>
                    <button
                      className="button secondary danger"
                      disabled={busy}
                      onClick={() =>
                        setPending({
                          name: "closeAttendanceSession",
                          input: { sessionId: session.id },
                          title: "Close attendance now?",
                          message:
                            "New check-ins will be rejected. Existing records remain saved.",
                          label: "Close session",
                        })
                      }
                    >
                      Close session
                    </button>
                  </div>
                )}
              </article>
            ))}
            {totalSessionPages > 1 && (
              <div className="management-actions" style={{ marginTop: "1rem", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  type="button"
                  className="button secondary"
                  disabled={currentSessionPage <= 1}
                  onClick={() => setSessionPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="muted" style={{ fontSize: "0.85rem" }}>
                  Page {currentSessionPage} of {totalSessionPages} ({totalSessions} sessions)
                </span>
                <button
                  type="button"
                  className="button secondary"
                  disabled={currentSessionPage >= totalSessionPages}
                  onClick={() => setSessionPage((p) => Math.min(totalSessionPages, p + 1))}
                >
                  Next
                </button>
              </div>
            )}
          </section>
        </>
      )}
      <ConfirmDialog
        open={!!pending}
        title={pending?.title || ""}
        message={pending?.message || ""}
        confirmLabel={pending?.label}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={execute}
      />
    </>
  );
}
export default function TeacherClass() {
  return (
    <ManagementAccess>
      <ClassDetail />
    </ManagementAccess>
  );
}
