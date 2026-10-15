const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash, randomBytes } = require("node:crypto");

// Setup in-memory mock environment before requiring functions
class MockDocSnapshot {
  constructor(id, data) {
    this.id = id;
    this._data = data ? { ...data } : null;
    this.exists = this._data !== null;
  }
  data() {
    if (!this.exists) return undefined;
    const copy = { ...this._data };
    for (const [k, v] of Object.entries(copy)) {
      if (v && typeof v.toDate === "function") {
        // already a valid Timestamp
      } else if (v && (v._seconds !== undefined || v.__isTimestamp)) {
        const millis = v.millis !== undefined ? v.millis : v._seconds * 1000;
        copy[k] = {
          toDate: () => new Date(millis),
          toMillis: () => millis,
        };
      }
    }
    return copy;
  }
}

class MockQuerySnapshot {
  constructor(docs) {
    this.docs = docs;
    this.empty = docs.length === 0;
    this.size = docs.length;
  }
}

class InMemoryFirestore {
  constructor() {
    this.store = new Map();
  }

  _clean(path) {
    return path.replace(/^\/+|\/+$/g, "");
  }

  doc(path) {
    const cleanPath = this._clean(path);
    const self = this;
    return {
      id: cleanPath.split("/").pop(),
      path: cleanPath,
      async get() {
        return new MockDocSnapshot(this.id, self.store.get(cleanPath) || null);
      },
      async set(data, options = {}) {
        if (options.merge && self.store.has(cleanPath)) {
          const prev = self.store.get(cleanPath);
          self.store.set(cleanPath, { ...prev, ...data });
        } else {
          self.store.set(cleanPath, { ...data });
        }
      },
      collection(sub) {
        return self.collection(`${cleanPath}/${sub}`);
      },
    };
  }

  collection(path) {
    const cleanPath = this._clean(path);
    const self = this;
    return {
      path: cleanPath,
      doc(id) {
        const docId = id || `auto_${Math.random().toString(36).slice(2, 10)}`;
        return self.doc(`${cleanPath}/${docId}`);
      },
      where(field, op, val) {
        return this._query([{ field, op, val }]);
      },
      limit(n) {
        return this._query([]).limit(n);
      },
      _query(filters) {
        return {
          where(field, op, val) {
            return self.collection(cleanPath)._query([...filters, { field, op, val }]);
          },
          limit(n) {
            this._limit = n;
            return this;
          },
          async get() {
            const prefix = cleanPath + "/";
            const docs = [];
            for (const [p, data] of self.store.entries()) {
              if (p.startsWith(prefix)) {
                const sub = p.slice(prefix.length);
                if (!sub.includes("/")) {
                  let match = true;
                  for (const f of filters) {
                    if (f.op === "==" && data[f.field] !== f.val) match = false;
                  }
                  if (match) {
                    const id = sub;
                    docs.push(new MockDocSnapshot(id, data));
                  }
                }
              }
            }
            const limited = this._limit ? docs.slice(0, this._limit) : docs;
            return new MockQuerySnapshot(limited);
          },
        };
      },
      async get() {
        return this._query([]).get();
      },
      async add(data) {
        const d = this.doc();
        await d.set(data);
        return d;
      },
    };
  }

  async runTransaction(updateFn) {
    const self = this;
    const transaction = {
      async get(docRef) {
        return docRef.get();
      },
      set(docRef, data, options = {}) {
        if (options.merge && self.store.has(docRef.path)) {
          const prev = self.store.get(docRef.path);
          self.store.set(docRef.path, { ...prev, ...data });
        } else {
          self.store.set(docRef.path, { ...data });
        }
      },
      create(docRef, data) {
        if (self.store.has(docRef.path)) {
          const err = new Error(`Document already exists at ${docRef.path}`);
          err.code = "already-exists";
          throw err;
        }
        self.store.set(docRef.path, { ...data });
      },
      update(docRef, data) {
        if (!self.store.has(docRef.path)) {
          const err = new Error(`Document not found at ${docRef.path}`);
          err.code = "not-found";
          throw err;
        }
        const prev = self.store.get(docRef.path);
        self.store.set(docRef.path, { ...prev, ...data });
      },
    };
    return updateFn(transaction);
  }
}

// Global in-memory DB and user registry
const mockDb = new InMemoryFirestore();
const mockUsers = new Map();

// Helper to seed users
function seedUser({ uid, email, emailVerified = true, role = "student", disabled = false, tokensValidAfterTime = null, displayName = "" }) {
  mockUsers.set(uid, {
    uid,
    email,
    emailVerified,
    disabled,
    tokensValidAfterTime,
    customClaims: role === "student" ? {} : { role },
    displayName,
  });
}

// Monkey-patch firebase-admin modules before loading index.js
const adminApp = require("firebase-admin/app");
const adminAuth = require("firebase-admin/auth");
const adminFirestore = require("firebase-admin/firestore");

adminApp.initializeApp = () => ({});
adminApp.getApps = () => [{}];

adminFirestore.getFirestore = () => mockDb;
adminFirestore.FieldValue = {
  serverTimestamp: () => ({ __isTimestamp: true, millis: Date.now() }),
};
adminFirestore.Timestamp = {
  fromDate: (date) => ({ __isTimestamp: true, millis: date.getTime() }),
};

adminAuth.getAuth = () => ({
  async getUser(uid) {
    if (!mockUsers.has(uid)) {
      const err = new Error(`User ${uid} not found`);
      err.code = "auth/user-not-found";
      throw err;
    }
    return mockUsers.get(uid);
  },
  async getUserByEmail(email) {
    for (const u of mockUsers.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    const err = new Error(`User with email ${email} not found`);
    err.code = "auth/user-not-found";
    throw err;
  },
});

// Load the callable functions under test
const backend = require("../index.js");

// Setup initial test accounts
const TEACHER_UID = "teacher_1";
const TEACHER_2_UID = "teacher_2";
const ADMIN_UID = "admin_1";
const STUDENT_UID = "student_1";
const UNVERIFIED_UID = "unverified_1";

seedUser({ uid: TEACHER_UID, email: "teacher1@school.edu", role: "teacher" });
seedUser({ uid: TEACHER_2_UID, email: "teacher2@school.edu", role: "teacher" });
seedUser({ uid: ADMIN_UID, email: "admin@school.edu", role: "admin" });
seedUser({ uid: STUDENT_UID, email: "student1@school.edu", role: "student", displayName: "Student One" });
seedUser({ uid: UNVERIFIED_UID, email: "unverified@school.edu", emailVerified: false, role: "student" });

function makeAuth(uid, emailVerified = true, role = "student", authTime = Math.floor(Date.now() / 1000)) {
  return {
    uid,
    token: {
      email_verified: emailVerified,
      role,
      auth_time: authTime,
      iat: authTime,
    },
  };
}

// ==========================================
// TEST SUITE
// ==========================================

test("1. Anonymous callers (no auth) are rejected across all callables", async () => {
  const callables = [
    backend.listManagedClasses,
    backend.createClass,
    backend.getManagedClass,
    backend.enrollStudent,
    backend.removeStudent,
    backend.startAttendanceSession,
    backend.rotateAttendanceQR,
    backend.closeAttendanceSession,
    backend.markAttendance,
  ];

  for (const fn of callables) {
    await assert.rejects(
      async () => fn.run({ data: {}, auth: null }),
      (err) => err.code === "unauthenticated",
    );
  }
});

test("2. Unverified email callers are rejected across all callables", async () => {
  const unverifiedAuth = makeAuth(UNVERIFIED_UID, false, "student");
  const callables = [
    backend.listManagedClasses,
    backend.createClass,
    backend.getManagedClass,
    backend.enrollStudent,
    backend.removeStudent,
    backend.startAttendanceSession,
    backend.rotateAttendanceQR,
    backend.closeAttendanceSession,
    backend.markAttendance,
  ];

  for (const fn of callables) {
    await assert.rejects(
      async () => fn.run({ data: { sessionId: "s", token: "t".repeat(32) }, auth: unverifiedAuth }),
      (err) => err.code === "failed-precondition",
    );
  }
});

test("3. Student privilege escalation is denied on management callables", async () => {
  const studentAuth = makeAuth(STUDENT_UID, true, "student");

  await assert.rejects(
    async () => backend.listManagedClasses.run({ data: {}, auth: studentAuth }),
    (err) => err.code === "permission-denied",
  );

  await assert.rejects(
    async () => backend.createClass.run({ data: { subject: "CS101", code: "SEC-1" }, auth: studentAuth }),
    (err) => err.code === "permission-denied",
  );

  // Even if student claims role='teacher' in their ID token, Admin Auth authoritative check denies them!
  const fakeTokenAuth = makeAuth(STUDENT_UID, true, "teacher");
  await assert.rejects(
    async () => backend.createClass.run({ data: { subject: "CS101", code: "SEC-1" }, auth: fakeTokenAuth }),
    (err) => err.code === "permission-denied",
  );
});

test("4. Unrecognized or invalid role values are denied", async () => {
  const INVALID_UID = "invalid_role_uid";
  seedUser({ uid: INVALID_UID, email: "invalid@school.edu", role: "ADMIN" }); // uppercase ADMIN is invalid
  const invalidAuth = makeAuth(INVALID_UID, true, "ADMIN");

  await assert.rejects(
    async () => backend.listManagedClasses.run({ data: {}, auth: invalidAuth }),
    (err) => err.code === "permission-denied",
  );
});

let testClassId = null;

test("5. Teacher creates class with validation and requestId deduplication", async () => {
  const teacherAuth = makeAuth(TEACHER_UID, true, "teacher");

  // Invalid inputs rejected
  await assert.rejects(
    async () => backend.createClass.run({ data: { subject: "", code: "1" }, auth: teacherAuth }),
    (err) => err.code === "invalid-argument",
  );

  const reqId = "req_12345";
  const result1 = await backend.createClass.run({
    data: { subject: "Computer Networks", code: "CS-201", room: "Lab 3", requestId: reqId },
    auth: teacherAuth,
  });

  assert.ok(result1.class.id);
  assert.equal(result1.class.subject, "Computer Networks");
  assert.equal(result1.class.ownerUid, TEACHER_UID);
  testClassId = result1.class.id;

  // Deduplicated retry with same requestId returns existing class
  const result2 = await backend.createClass.run({
    data: { subject: "Computer Networks", code: "CS-201", room: "Lab 3", requestId: reqId },
    auth: teacherAuth,
  });
  assert.equal(result2.class.id, testClassId);
});

test("6. Teacher cross-class access is denied; Admin can access", async () => {
  const teacher2Auth = makeAuth(TEACHER_2_UID, true, "teacher");
  const adminAuth = makeAuth(ADMIN_UID, true, "admin");

  // Teacher 2 cannot view Teacher 1's class
  await assert.rejects(
    async () => backend.getManagedClass.run({ data: { classId: testClassId }, auth: teacher2Auth }),
    (err) => err.code === "permission-denied",
  );

  // Admin CAN view Teacher 1's class
  const adminView = await backend.getManagedClass.run({ data: { classId: testClassId }, auth: adminAuth });
  assert.equal(adminView.class.id, testClassId);
});

test("7. Student enrollment rejects unknown email, unverified email, and teachers", async () => {
  const teacherAuth = makeAuth(TEACHER_UID, true, "teacher");

  // Unknown email
  await assert.rejects(
    async () => backend.enrollStudent.run({ data: { classId: testClassId, email: "unknown@school.edu" }, auth: teacherAuth }),
    (err) => err.code === "not-found",
  );

  // Unverified student
  await assert.rejects(
    async () => backend.enrollStudent.run({ data: { classId: testClassId, email: "unverified@school.edu" }, auth: teacherAuth }),
    (err) => err.code === "failed-precondition",
  );

  // Teacher account cannot be enrolled as student
  await assert.rejects(
    async () => backend.enrollStudent.run({ data: { classId: testClassId, email: "teacher2@school.edu" }, auth: teacherAuth }),
    (err) => err.code === "failed-precondition",
  );

  // Valid verified student enrollment succeeds
  const enrollRes = await backend.enrollStudent.run({
    data: { classId: testClassId, email: "student1@school.edu" },
    auth: teacherAuth,
  });
  assert.equal(enrollRes.ok, true);

  // Verify enrolled in class details
  const details = await backend.getManagedClass.run({ data: { classId: testClassId }, auth: teacherAuth });
  assert.equal(details.students.length, 1);
  assert.equal(details.students[0].uid, STUDENT_UID);
});

let activeSessionId = null;
let activeSessionToken = null;

test("8. Attendance session creation validates times, IANA zone, and issues QR", async () => {
  const teacherAuth = makeAuth(TEACHER_UID, true, "teacher");

  const now = Date.now();
  const startsAt = new Date(now - 10 * 60 * 1000).toISOString(); // 10 min ago
  const lateAfter = new Date(now + 10 * 60 * 1000).toISOString(); // in 10 min
  const endsAt = new Date(now + 60 * 60 * 1000).toISOString(); // in 60 min

  // Chronology validation
  await assert.rejects(
    async () => backend.startAttendanceSession.run({
      data: { classId: testClassId, startsAt: endsAt, lateAfter, endsAt: startsAt, timeZone: "Asia/Manila" },
      auth: teacherAuth,
    }),
    (err) => err.code === "invalid-argument",
  );

  // Invalid time zone
  await assert.rejects(
    async () => backend.startAttendanceSession.run({
      data: { classId: testClassId, startsAt, lateAfter, endsAt, timeZone: "Invalid/Fake_Zone" },
      auth: teacherAuth,
    }),
    (err) => err.code === "invalid-argument",
  );

  // Valid session creation
  const res = await backend.startAttendanceSession.run({
    data: { classId: testClassId, startsAt, lateAfter, endsAt, timeZone: "Asia/Manila", requestId: "sess_req_1" },
    auth: teacherAuth,
  });

  assert.ok(res.session.id);
  assert.equal(res.session.classId, testClassId);
  assert.equal(res.session.subject, "Computer Networks");
  assert.equal(res.session.closed, false);
  assert.equal(res.qrPayload.app, "StudentAttendance");
  assert.equal(res.qrPayload.v, 1);
  assert.ok(res.qrPayload.token.length >= 32);

  activeSessionId = res.session.id;
  activeSessionToken = res.qrPayload.token;
});

test("9. Attendance verification: valid scan succeeds; duplicates and invalid QR rejected", async () => {
  const studentAuth = makeAuth(STUDENT_UID, true, "student");

  // Invalid token rejected
  await assert.rejects(
    async () => backend.markAttendance.run({
      data: { sessionId: activeSessionId, token: "wrong_token_".padEnd(43, "x") },
      auth: studentAuth,
    }),
    (err) => err.code === "permission-denied",
  );

  // Valid scan records attendance
  const record = await backend.markAttendance.run({
    data: { sessionId: activeSessionId, token: activeSessionToken },
    auth: studentAuth,
  });

  assert.equal(record.sessionId, activeSessionId);
  assert.equal(record.subject, "Computer Networks");
  assert.equal(record.status, "Present");
  assert.equal(record.source, "School verified");

  // Duplicate scan rejected transactionally
  await assert.rejects(
    async () => backend.markAttendance.run({
      data: { sessionId: activeSessionId, token: activeSessionToken },
      auth: studentAuth,
    }),
    (err) => err.code === "already-exists",
  );
});

test("10. QR rotation replaces active token; old token rejected", async () => {
  const teacherAuth = makeAuth(TEACHER_UID, true, "teacher");

  // Create a second student
  const STUDENT_2_UID = "student_2";
  seedUser({ uid: STUDENT_2_UID, email: "student2@school.edu", role: "student" });
  await backend.enrollStudent.run({
    data: { classId: testClassId, email: "student2@school.edu" },
    auth: teacherAuth,
  });

  // Rotate QR
  const rotRes = await backend.rotateAttendanceQR.run({
    data: { sessionId: activeSessionId },
    auth: teacherAuth,
  });

  const newToken = rotRes.qrPayload.token;
  assert.notEqual(newToken, activeSessionToken);

  const student2Auth = makeAuth(STUDENT_2_UID, true, "student");

  // Old token rejected
  await assert.rejects(
    async () => backend.markAttendance.run({
      data: { sessionId: activeSessionId, token: activeSessionToken },
      auth: student2Auth,
    }),
    (err) => err.code === "permission-denied",
  );

  // New rotated token succeeds
  const rec2 = await backend.markAttendance.run({
    data: { sessionId: activeSessionId, token: newToken },
    auth: student2Auth,
  });
  assert.equal(rec2.status, "Present");
});

test("11. Closing attendance session rejects subsequent scans", async () => {
  const teacherAuth = makeAuth(TEACHER_UID, true, "teacher");
  const closeRes = await backend.closeAttendanceSession.run({
    data: { sessionId: activeSessionId },
    auth: teacherAuth,
  });
  assert.equal(closeRes.ok, true);

  // Create student 3
  const STUDENT_3_UID = "student_3";
  seedUser({ uid: STUDENT_3_UID, email: "student3@school.edu", role: "student" });
  await backend.enrollStudent.run({
    data: { classId: testClassId, email: "student3@school.edu" },
    auth: teacherAuth,
  });

  const student3Auth = makeAuth(STUDENT_3_UID, true, "student");
  await assert.rejects(
    async () => backend.markAttendance.run({
      data: { sessionId: activeSessionId, token: "any_token_32_chars_long_placeholder" },
      auth: student3Auth,
    }),
    (err) => err.code === "failed-precondition",
  );
});

test("12. Revoking enrollment immediately blocks check-in on open sessions", async () => {
  const teacherAuth = makeAuth(TEACHER_UID, true, "teacher");

  // Create open session
  const now = Date.now();
  const sess = await backend.startAttendanceSession.run({
    data: {
      classId: testClassId,
      startsAt: new Date(now - 5 * 60 * 1000).toISOString(),
      lateAfter: new Date(now + 15 * 60 * 1000).toISOString(),
      endsAt: new Date(now + 60 * 60 * 1000).toISOString(),
      timeZone: "Asia/Manila",
    },
    auth: teacherAuth,
  });

  const STUDENT_4_UID = "student_4";
  seedUser({ uid: STUDENT_4_UID, email: "student4@school.edu", role: "student" });
  await backend.enrollStudent.run({
    data: { classId: testClassId, email: "student4@school.edu" },
    auth: teacherAuth,
  });

  // Remove student from class enrollment
  await backend.removeStudent.run({
    data: { classId: testClassId, uid: STUDENT_4_UID },
    auth: teacherAuth,
  });

  // Student 4 attempt to scan is denied
  const s4Auth = makeAuth(STUDENT_4_UID, true, "student");
  await assert.rejects(
    async () => backend.markAttendance.run({
      data: { sessionId: sess.session.id, token: sess.qrPayload.token },
      auth: s4Auth,
    }),
    (err) => err.code === "permission-denied",
  );
});

test("13. Personal timetable subjects do not grant school enrollment", async () => {
  const STUDENT_5_UID = "student_5";
  seedUser({ uid: STUDENT_5_UID, email: "student5@school.edu", role: "student" });
  // Add personal timetable subject
  await mockDb.doc(`users/${STUDENT_5_UID}/subjects/personal_sub_1`).set({
    subject: "Computer Networks",
    day: 1,
    time: "09:00",
    end: "10:30",
    teacher: "Teacher",
    room: "Lab 3",
  });

  // Create open session for Computer Networks
  const teacherAuth = makeAuth(TEACHER_UID, true, "teacher");
  const now = Date.now();
  const sess = await backend.startAttendanceSession.run({
    data: {
      classId: testClassId,
      startsAt: new Date(now - 5 * 60 * 1000).toISOString(),
      lateAfter: new Date(now + 15 * 60 * 1000).toISOString(),
      endsAt: new Date(now + 60 * 60 * 1000).toISOString(),
      timeZone: "Asia/Manila",
    },
    auth: teacherAuth,
  });

  // Student 5 is NOT enrolled in schoolClasses -> rejected
  const s5Auth = makeAuth(STUDENT_5_UID, true, "student");
  await assert.rejects(
    async () => backend.markAttendance.run({
      data: { sessionId: sess.session.id, token: sess.qrPayload.token },
      auth: s5Auth,
    }),
    (err) => err.code === "permission-denied",
  );
});

test("14. Notifications preference is respected", async () => {
  const teacherAuth = makeAuth(TEACHER_UID, true, "teacher");
  const STUDENT_6_UID = "student_6";
  seedUser({ uid: STUDENT_6_UID, email: "student6@school.edu", role: "student" });
  await backend.enrollStudent.run({
    data: { classId: testClassId, email: "student6@school.edu" },
    auth: teacherAuth,
  });

  // Set notifications: false in user profile
  await mockDb.doc(`users/${STUDENT_6_UID}`).set({
    settings: { notifications: false, theme: "system" },
  });

  const now = Date.now();
  const sess = await backend.startAttendanceSession.run({
    data: {
      classId: testClassId,
      startsAt: new Date(now - 5 * 60 * 1000).toISOString(),
      lateAfter: new Date(now + 15 * 60 * 1000).toISOString(),
      endsAt: new Date(now + 60 * 60 * 1000).toISOString(),
      timeZone: "Asia/Manila",
    },
    auth: teacherAuth,
  });

  const s6Auth = makeAuth(STUDENT_6_UID, true, "student");
  await backend.markAttendance.run({
    data: { sessionId: sess.session.id, token: sess.qrPayload.token },
    auth: s6Auth,
  });

  // Attendance record exists
  const attSnap = await mockDb.doc(`users/${STUDENT_6_UID}/attendance/${sess.session.id}`).get();
  assert.equal(attSnap.exists, true);

  // Notification doc was NOT created because notifications: false
  const notifSnap = await mockDb.doc(`users/${STUDENT_6_UID}/notifications/${sess.session.id}`).get();
  assert.equal(notifSnap.exists, false);
});

test("15. IMPORTANT REVOCATION REQUIREMENT: Pre-revocation teacher JWT cannot manage classes after role removal", async () => {
  const REVOKED_TEACHER_UID = "teacher_revoked";
  const issueTime = Math.floor(Date.now() / 1000) - 100; // token issued 100s ago

  // 1. User was initially a teacher
  seedUser({ uid: REVOKED_TEACHER_UID, email: "teacher_revoked@school.edu", role: "teacher" });

  // 2. Client still holds pre-revocation JWT containing claims { role: 'teacher' } and auth_time = issueTime
  const preRevocationJWT = makeAuth(REVOKED_TEACHER_UID, true, "teacher", issueTime);

  // 3. User can initially create class
  const classRes = await backend.createClass.run({
    data: { subject: "Initial Class", code: "INIT-1" },
    auth: preRevocationJWT,
  });
  assert.ok(classRes.class.id);

  // 4. Admin removes teacher role and revokes tokens (tokensValidAfterTime set to current time)
  const revocationTime = new Date(Date.now());
  seedUser({
    uid: REVOKED_TEACHER_UID,
    email: "teacher_revoked@school.edu",
    role: "student", // role removed
    tokensValidAfterTime: revocationTime.toISOString(),
  });

  // 5. Stale pre-revocation JWT is passed to listManagedClasses -> MUST BE REJECTED!
  await assert.rejects(
    async () => backend.listManagedClasses.run({ data: {}, auth: preRevocationJWT }),
    (err) => err.code === "permission-denied",
  );

  // 6. Stale pre-revocation JWT is passed to createClass -> MUST BE REJECTED!
  await assert.rejects(
    async () => backend.createClass.run({ data: { subject: "Hacked Class", code: "HACK-1" }, auth: preRevocationJWT }),
    (err) => err.code === "permission-denied",
  );
});
