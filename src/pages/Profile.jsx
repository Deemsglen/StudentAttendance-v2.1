import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Settings, SquarePen, Camera } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { friendlyError } from "../services/firebase";
import Avatar from "../components/Avatar";
import ConfirmDialog from "../components/ConfirmDialog";
import { resizePhoto } from "../utils/photo";
export default function Profile() {
  const { user, updateProfile, logout, verifyEmail, refreshVerification } =
      useAuth(),
    navigate = useNavigate(),
    input = useRef();
  const [edit, setEdit] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmLogout, setConfirmLogout] = useState(false);
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
  async function save(e) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    for (const k of ["name", "course", "studentId"])
      values[k] = values[k].trim();
    if (!values.name || !values.course || !values.studentId)
      return setMessage("Complete your name, student ID and course.");
    await run(async () => {
      await updateProfile(values);
      setEdit(false);
      setMessage("Profile saved.");
    });
  }
  return (
    <>
      <div className="page-title">
        <span className="eyebrow">THIS IS YOU</span>
        <h1>My profile</h1>
      </div>
      <section className="profile-hero">
        <Avatar user={user} large />
        <h2>{user.name}</h2>
        <p>{user.studentId || "Complete your student details"}</p>
        <input
          ref={input}
          hidden
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Upload profile photo"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file)
              run(async () => {
                const avatar = await resizePhoto(file);
                await updateProfile({ avatar });
                setMessage("Profile photo uploaded successfully.");
              });
          }}
        />
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Camera size={18} />
          {busy ? "Uploading…" : "Upload photo"}
        </button>
        {user.avatar && (
          <button
            className="text-button remove-photo"
            disabled={busy}
            onClick={() => run(() => updateProfile({ avatar: "" }))}
          >
            Remove photo
          </button>
        )}
      </section>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {!user.emailVerified && (
        <section className="notice">
          <strong>Verify your email to record attendance</strong>
          <div className="dialog-actions">
            <button
              disabled={busy}
              className="text-button"
              onClick={() =>
                run(async () => {
                  await verifyEmail();
                  setMessage("Verification email requested. Check your inbox.");
                })
              }
            >
              Send verification
            </button>
            <button
              disabled={busy}
              className="text-button"
              onClick={() => run(refreshVerification)}
            >
              I have verified
            </button>
          </div>
        </section>
      )}
      {edit ? (
        <form className="panel" onSubmit={save}>
          {[
            ["name", "Full name"],
            ["studentId", "Student ID"],
            ["course", "Course"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                name={key}
                defaultValue={user[key]}
                required
                maxLength={100}
              />
            </label>
          ))}
          <label>
            Year level
            <select name="year" defaultValue={user.year}>
              {[1, 2, 3, 4, 5].map((y) => (
                <option value={y} key={y}>
                  Year {y}
                </option>
              ))}
            </select>
          </label>
          <button className="button full" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => setEdit(false)}
          >
            Cancel
          </button>
        </form>
      ) : (
        <section className="panel">
          <dl>
            {[
              ["Student ID", user.studentId || "Not set"],
              ["Email", user.email],
              ["Course", user.course || "Not set"],
              ["Year level", `Year ${user.year}`],
              [
                "Email status",
                user.emailVerified ? "Verified" : "Not verified",
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <button
            className="button secondary full"
            onClick={() => setEdit(true)}
          >
            <SquarePen size={18} />
            Edit profile
          </button>
        </section>
      )}
      <Link to="/settings" className="menu-row">
        <Settings size={20} />
        Settings<span>→</span>
      </Link>
      <button
        className="menu-row danger"
        onClick={() => setConfirmLogout(true)}
      >
        <LogOut size={20} />
        Log out
      </button>
      <p className="muted">
        Your account's cloud data stays saved when you sign out. Schedule photos
        are processed on this device; only the confirmed schedule is saved.
      </p>
      <ConfirmDialog
        open={confirmLogout}
        title="Are you sure you want to log out?"
        message="You will need to sign in again to access your personal schedule and records."
        confirmLabel="Yes, log out"
        busy={busy}
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() =>
          run(async () => {
            await logout();
            navigate("/login", { replace: true });
          })
        }
      />
    </>
  );
}
