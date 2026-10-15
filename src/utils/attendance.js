export function parseAttendanceQR(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Invalid attendance QR code.");
  }
  if (
    !data ||
    data.app !== "StudentAttendance" ||
    data.v !== 1 ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(data.sessionId || "") ||
    !/^[A-Za-z0-9_-]{32,256}$/.test(data.token || "")
  )
    throw new Error(
      "Use a current attendance QR issued by your school. Legacy sample codes are not accepted.",
    );
  return { sessionId: data.sessionId, token: data.token };
}
export function summarize(records) {
  const counts = { Present: 0, Late: 0, Absent: 0 };
  records.forEach((r) => {
    if (r.status in counts) counts[r.status]++;
  });
  return {
    ...counts,
    total: records.length,
    percentage: records.length
      ? Math.round(((counts.Present + counts.Late) / records.length) * 100)
      : 0,
  };
}
export function toCSV(records) {
  const quote = (v) =>
    '"' +
    String(v ?? "")
      .replaceAll('"', '""')
      .replace(/^[=+@-]/, "'$&") +
    '"';
  return (
    "\uFEFF" +
    [
      ["Subject", "Date", "Time", "Status", "Source"],
      ...records.map((r) => [r.subject, r.date, r.time, r.status, r.source]),
    ]
      .map((row) => row.map(quote).join(","))
      .join("\r\n")
  );
}
