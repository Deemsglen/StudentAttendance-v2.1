import test from "node:test";
import assert from "node:assert/strict";
import {
  accessRole,
  validateClass,
  validateSession,
  validatedQR,
} from "../src/utils/management.js";
test("roles default to student and only exact trusted values grant access", () => {
  for (const role of [undefined, "ADMIN", "owner", true])
    assert.equal(accessRole({ role }), "student");
  assert.equal(accessRole({ role: "teacher" }), "teacher");
  assert.equal(accessRole({ role: "admin" }), "admin");
});
test("class fields validated and normalized", () => {
  assert.deepEqual(validateClass({ subject: "  Networks ", code: " IT2 " }), {
    subject: "Networks",
    code: "IT2",
    room: "",
  });
  assert.throws(() => validateClass({ subject: "X" }));
});
test("session validates time order and IANA zone", () => {
  const values = {
    startsAt: "2026-10-14T09:00:00Z",
    lateAfter: "2026-10-14T09:15:00Z",
    endsAt: "2026-10-14T10:00:00Z",
    timeZone: "Asia/Manila",
  };
  assert.equal(validateSession(values).endsAt, "2026-10-14T10:00:00.000Z");
  assert.throws(() =>
    validateSession({ ...values, lateAfter: "2026-10-14T11:00:00Z" }),
  );
  assert.throws(() => validateSession({ ...values, timeZone: "Fake/Zone" }));
  assert.throws(() => validateSession({ ...values, startsAt: "" }));
});
test("QR must match server session and valid school payload", () => {
  const result = {
    session: { id: "class_session" },
    qrPayload: {
      app: "StudentAttendance",
      v: 1,
      sessionId: "class_session",
      token: "a".repeat(43),
    },
  };
  assert.equal(JSON.parse(validatedQR(result)).sessionId, "class_session");
  assert.throws(() => validatedQR({ ...result, session: { id: "different" } }));
  assert.throws(() =>
    validatedQR({ session: { id: "x" }, qrPayload: { app: "demo" } }),
  );
});
