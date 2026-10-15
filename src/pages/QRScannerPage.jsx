import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import QRScanner from "../components/QRScanner";
import { useAttendance } from "../context/AttendanceContext";
import { useAuth } from "../context/AuthContext";
import { friendlyError } from "../services/firebase";
export default function QRScannerPage() {
  const { scan } = useAttendance(),
    { user } = useAuth(),
    [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function handle(raw) {
    setResult(null);
    setError("");
    setBusy(true);
    try {
      setResult(await scan(raw));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-title">
        <span className="eyebrow">YOUR SCHOOL CHECK-IN</span>
        <h1>Scan attendance</h1>
        <p className="muted">
          Scan the current QR displayed by your instructor.
        </p>
      </div>
      <p className="notice">
        Attendance is checked by the school service for enrollment, session time
        and duplicates. Personal timetable entries alone cannot create
        attendance.
      </p>
      {!user.emailVerified && (
        <p className="error">
          Verify your email in Profile before checking in.
        </p>
      )}
      {busy && (
        <div className="notice" role="status">
          <span className="spinner" />
          Verifying your attendance with the server…
        </div>
      )}
      {result && (
        <div className="success" role="status">
          <CheckCircle2 />
          <strong>Attendance confirmed</strong>
          <p>
            {result.subject} · {result.status} · {result.time}
          </p>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!busy && user.emailVerified && <QRScanner onResult={handle} />}
      <p className="muted">
        No camera? Ask your instructor to record your attendance through the
        school's authorized process. This app does not generate or simulate
        check-ins.
      </p>
    </>
  );
}
