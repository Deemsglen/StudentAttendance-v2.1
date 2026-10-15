import { useState, useRef, useEffect } from "react";
import {
  Clock3,
  MapPin,
  UserRound,
  Plus,
  SquarePen,
  Trash2,
} from "lucide-react";
import { useAttendance } from "../context/AttendanceContext";
import { DAY_NAMES, validateSubject } from "../utils/schedule";
import { friendlyError } from "../services/firebase";
import EmptyState from "../components/EmptyState";
import ScheduleImporter from "../components/ScheduleImporter";
import SubjectEditor, { blankSubject } from "../components/SubjectEditor";
import ConfirmDialog from "../components/ConfirmDialog";
export default function Schedule() {
  const { subjects, saveSubjects, deleteSubject } = useAttendance(),
    today = new Date().getDay();
  const [day, setDay] = useState(today),
    [draft, setDraft] = useState([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [remove, setRemove] = useState(null);
  const reviewRef = useRef(null);
  useEffect(() => {
    if (draft.length) reviewRef.current?.scrollIntoView({ block: "start" });
  }, [draft.length]);
  const filtered = subjects
    .filter((s) => s.day === day)
    .sort((a, b) => a.time.localeCompare(b.time));
  function review(e) {
    e.preventDefault();
    setError("");
    try {
      draft.forEach(validateSubject);
      setConfirm(true);
    } catch (e) {
      setError(e.message);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      await saveSubjects(draft);
      setDraft([]);
      setConfirm(false);
      setMessage("Schedule saved successfully to your account.");
    } catch (e) {
      setConfirm(false);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-title">
        <span className="eyebrow">YOUR OWN TIMETABLE</span>
        <h1>My subjects & schedule</h1>
        <p className="muted">
          Different students, different days. Build a schedule that is truly
          yours.
        </p>
      </div>
      <button
        className="button full"
        onClick={() => {
          setMessage("");
          setDraft([blankSubject(day)]);
        }}
        disabled={busy}
      >
        <Plus size={19} />
        Add subject
      </button>
      <ScheduleImporter
        onDraft={(rows) => {
          setDraft(rows);
          setMessage("");
        }}
      />
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {draft.length > 0 && (
        <form ref={reviewRef} className="panel review-panel" onSubmit={review}>
          <span className="eyebrow">REVIEW BEFORE SAVING</span>
          <h2>Confirm your class meetings</h2>
          <p className="muted">
            Check every subject, day and time. Suggestions are not saved until
            you confirm.
          </p>
          <SubjectEditor rows={draft} onChange={setDraft} busy={busy} />
          <button className="button full" disabled={busy}>
            Review & confirm {draft.length} meeting
            {draft.length === 1 ? "" : "s"}
          </button>
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={() => setDraft([])}
          >
            Discard draft
          </button>
        </form>
      )}
      <div className="week-tabs">
        {DAY_NAMES.map((d, i) => (
          <button
            key={d}
            onClick={() => setDay(i)}
            aria-pressed={day === i}
            className={`${day === i ? "selected" : ""} ${today === i ? "today" : ""}`}
          >
            {d.slice(0, 3)}
            {today === i && <small>Today</small>}
          </button>
        ))}
      </div>
      <div className="section-heading">
        <h2>{DAY_NAMES[day]}</h2>
        <span className="muted">
          {filtered.length} {filtered.length === 1 ? "class" : "classes"}
        </span>
      </div>
      {filtered.length ? (
        filtered.map((c) => (
          <article className="schedule-card" key={c.id}>
            <span className="eyebrow">
              {c.time} – {c.end}
            </span>
            <h2>{c.subject}</h2>
            {c.teacher && (
              <p>
                <UserRound size={16} />
                {c.teacher}
              </p>
            )}
            {c.room && (
              <p>
                <MapPin size={16} />
                {c.room}
              </p>
            )}
            <span className="badge present">
              <Clock3 size={14} />
              Scheduled
            </span>
            <div className="dialog-actions">
              <button
                className="text-button"
                disabled={busy}
                onClick={() => setDraft([{ ...c }])}
              >
                <SquarePen size={17} />
                Edit
              </button>
              <button
                className="text-button danger"
                disabled={busy}
                onClick={() => setRemove(c)}
              >
                <Trash2 size={17} />
                Remove
              </button>
            </div>
          </article>
        ))
      ) : (
        <EmptyState
          title="No classes set for this day"
          message="Add a subject or import your timetable photo. Your schedule is personal to your account."
        />
      )}
      <ConfirmDialog
        open={confirm}
        title="Save this schedule?"
        message={`Save ${draft.length} reviewed class meeting(s) to your personal account? Existing subjects are kept unless you are editing them.`}
        confirmLabel="Confirm & save"
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={save}
      />
      <ConfirmDialog
        open={!!remove}
        title="Remove this subject meeting?"
        message={
          remove
            ? `${remove.subject} • ${DAY_NAMES[remove.day]} ${remove.time}–${remove.end}. Existing attendance records will not be deleted.`
            : ""
        }
        confirmLabel="Remove meeting"
        busy={busy}
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await deleteSubject(remove.id);
            setRemove(null);
            setMessage("Class meeting removed. Attendance records were kept.");
          } catch (e) {
            setError(friendlyError(e));
            setRemove(null);
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
