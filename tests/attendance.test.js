import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAttendanceQR,
  summarize,
  toCSV,
} from "../src/utils/attendance.js";
test("current QR format parses without manufacturing attendance", () => {
  assert.deepEqual(
    parseAttendanceQR(
      JSON.stringify({
        app: "StudentAttendance",
        v: 1,
        sessionId: "session_123",
        token: "a".repeat(43),
      }),
    ),
    { sessionId: "session_123", token: "a".repeat(43) },
  );
});
test("legacy, malformed, empty and unsafe QR payloads rejected", () => {
  for (const raw of [
    "bad",
    "null",
    "[]",
    "{}",
    JSON.stringify({ app: "AbsenSiswa", mode: "demo", classId: "web" }),
    JSON.stringify({
      app: "StudentAttendance",
      v: 1,
      sessionId: "../../admin",
      token: "a".repeat(43),
    }),
  ])
    assert.throws(() => parseAttendanceQR(raw));
});
test("statistics include late and handle empty records", () => {
  assert.equal(summarize([]).percentage, 0);
  assert.equal(
    summarize([{ status: "Present" }, { status: "Late" }, { status: "Absent" }])
      .percentage,
    67,
  );
});
test("CSV preserves quoting and guards formulas", () => {
  const csv = toCSV([{ subject: "=SUM(1,2)", source: '"school"' }]);
  assert.ok(csv.includes('"\'=SUM(1,2)"'));
  assert.ok(csv.includes('""school""'));
});
