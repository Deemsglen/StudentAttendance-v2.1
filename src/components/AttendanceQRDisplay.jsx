import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Clock, ShieldCheck } from "lucide-react";
import { validatedQR } from "../utils/management";
export default function AttendanceQRDisplay({ result }) {
  const [image, setImage] = useState(""),
    [error, setError] = useState(""),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    let active = true;
    setImage("");
    setError("");
    try {
      const raw = validatedQR(result);
      QRCode.toDataURL(raw, {
        width: 640,
        margin: 4,
        errorCorrectionLevel: "M",
        color: { dark: "#192747", light: "#ffffff" },
      })
        .then((url) => {
          if (active) setImage(url);
        })
        .catch(() => {
          if (active)
            setError("Could not render QR. Rotate or reopen the session.");
        });
    } catch (e) {
      setError(e.message);
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [result]);
  const session = result?.session,
    expiry = Date.parse(session?.endsAt),
    start = Date.parse(session?.startsAt);
  const expired =
    !Number.isFinite(expiry) ||
    !Number.isFinite(start) ||
    now >= expiry ||
    session?.closed;
  return (
    <section className="panel qr-display" aria-label="Attendance QR display">
      <div className="section-heading">
        <h2>Student check-in QR</h2>
        <ShieldCheck size={22} />
      </div>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : expired ? (
        <p className="notice">
          Session ended or closed. This QR is no longer displayed.
        </p>
      ) : (
        <>
          {image ? (
            <img
              className="issued-qr"
              src={image}
              alt={`Attendance QR for ${session.subject}. Students scan using Student Attendance.`}
            />
          ) : (
            <p role="status">Preparing QR…</p>
          )}
          <strong>{session.subject}</strong>
          <p className="muted">
            {now < start
              ? "Scheduled — scanning is accepted only after the start time."
              : "Session open — enrolled students may scan."}
          </p>
          <p className="qr-expiry">
            <Clock size={18} /> Closes{" "}
            {new Date(expiry).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            · {session.timeZone}
          </p>
          <p className="notice">
            Display this to your class, not on public social media. The server
            checks enrollment, time and duplicate submissions. Rotation
            invalidates the previous QR.
          </p>
        </>
      )}
    </section>
  );
}
