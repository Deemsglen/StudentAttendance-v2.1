import { DAY_NAMES } from "../utils/schedule";
import { Trash2, Plus } from "lucide-react";
export const blankSubject = (day = new Date().getDay()) => ({
  subject: "",
  day,
  time: "",
  end: "",
  teacher: "",
  room: "",
});
export default function SubjectEditor({ rows, onChange, busy }) {
  function change(index, key, value) {
    onChange(rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  }
  return (
    <div className="subject-editor">
      {rows.map((row, index) => (
        <fieldset disabled={busy} key={index}>
          <legend>Class meeting {index + 1}</legend>
          <label>
            Subject
            <input
              required
              value={row.subject}
              maxLength={120}
              onChange={(e) => change(index, "subject", e.target.value)}
            />
          </label>
          <label>
            Class day
            <select
              value={row.day}
              onChange={(e) => change(index, "day", Number(e.target.value))}
            >
              {DAY_NAMES.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Start time
              <input
                required
                type="time"
                value={row.time}
                onChange={(e) => change(index, "time", e.target.value)}
              />
            </label>
            <label>
              End time
              <input
                required
                type="time"
                value={row.end}
                onChange={(e) => change(index, "end", e.target.value)}
              />
            </label>
          </div>
          <label>
            Teacher (optional)
            <input
              value={row.teacher}
              maxLength={120}
              onChange={(e) => change(index, "teacher", e.target.value)}
            />
          </label>
          <label>
            Room (optional)
            <input
              value={row.room}
              maxLength={100}
              onChange={(e) => change(index, "room", e.target.value)}
            />
          </label>
          <button
            className="text-button danger"
            type="button"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            <Trash2 size={17} />
            Remove this meeting
          </button>
        </fieldset>
      ))}
      <button
        className="text-button"
        type="button"
        disabled={busy || rows.length >= 100}
        onClick={() => onChange([...rows, blankSubject()])}
      >
        <Plus size={18} />
        Add another class meeting
      </button>
    </div>
  );
}
