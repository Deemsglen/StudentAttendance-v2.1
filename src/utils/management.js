import { parseAttendanceQR } from "./attendance.js";
export function accessRole(claims = {}) {
  return claims.role === "admin"
    ? "admin"
    : claims.role === "teacher"
      ? "teacher"
      : "student";
}
export function validateClass(values) {
  const subject = String(values.subject || "").trim();
  const code = String(values.code || "").trim();
  if (!subject || subject.length > 120)
    throw new Error("Enter a subject name (up to 120 characters).");
  if (!code || code.length > 40)
    throw new Error("Enter a class or section code (up to 40 characters).");
  return {
    subject,
    code,
    room: String(values.room || "")
      .trim()
      .slice(0, 120),
  };
}
export function validateSession(values) {
  const dates = ["startsAt", "lateAfter", "endsAt"].map(
    (k) => new Date(values[k]),
  );
  if (dates.some((d) => !Number.isFinite(d.getTime())))
    throw new Error("Complete all three session times.");
  if (!(dates[0] < dates[2]) || dates[1] < dates[0] || dates[1] > dates[2])
    throw new Error(
      "End must be after start. Late cutoff must be between start and end.",
    );
  try {
    new Intl.DateTimeFormat("en", { timeZone: values.timeZone }).format();
  } catch {
    throw new Error("Enter a valid IANA time zone, such as Asia/Manila.");
  }
  return {
    startsAt: dates[0].toISOString(),
    lateAfter: dates[1].toISOString(),
    endsAt: dates[2].toISOString(),
    timeZone: values.timeZone,
  };
}
export function validatedQR(result) {
  const payload = result?.qrPayload;
  const parsed = parseAttendanceQR(JSON.stringify(payload));
  if (parsed.sessionId !== result?.session?.id)
    throw new Error(
      "Backend returned a mismatched QR session. No QR displayed.",
    );
  return JSON.stringify({ app: "StudentAttendance", v: 1, ...parsed });
}
