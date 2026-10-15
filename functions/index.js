const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { createHash, randomBytes, timingSafeEqual } = require("node:crypto");

if (!getApps().length) {
  initializeApp();
}

const REGION = process.env.FIREBASE_FUNCTIONS_REGION || "asia-southeast1";
const CALLABLE_OPTS = { region: REGION, maxInstances: 10 };

/**
 * Validates caller authentication, email verification, active user state,
 * authoritative role claim from Firebase Admin Auth, and session revocation.
 */
async function requirePrivilegedCaller(request, allowedRoles = ["teacher", "admin"]) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required to access this service.");
  }
  if (request.auth.token.email_verified !== true) {
    throw new HttpsError(
      "failed-precondition",
      "Verify your email before accessing this service.",
    );
  }

  const uid = request.auth.uid;
  const authAdmin = getAuth();
  let userRecord;
  try {
    userRecord = await authAdmin.getUser(uid);
  } catch (err) {
    throw new HttpsError("permission-denied", "User account not found or inaccessible.");
  }

  if (userRecord.disabled) {
    throw new HttpsError("permission-denied", "Account has been disabled.");
  }

  // Authoritative server-side revocation check:
  // If tokensValidAfterTime is set (e.g. via revokeRefreshTokens), verify the ID token was issued after that time.
  if (userRecord.tokensValidAfterTime) {
    const validAfterSeconds = Math.floor(
      new Date(userRecord.tokensValidAfterTime).getTime() / 1000,
    );
    const authTime = request.auth.token.auth_time || request.auth.token.iat || 0;
    if (authTime < validAfterSeconds) {
      throw new HttpsError(
        "permission-denied",
        "Session credentials have been revoked. Please sign in again.",
      );
    }
  }

  // Authoritative server-side current-role check from Admin Auth user record:
  const currentRole = userRecord.customClaims?.role || "student";
  if (!allowedRoles.includes(currentRole)) {
    throw new HttpsError(
      "permission-denied",
      "Only an authorized teacher or administrator can perform this action.",
    );
  }

  return { uid, role: currentRole, userRecord };
}

/**
 * Validates IANA time zone string.
 */
function validateTimeZone(tz) {
  if (typeof tz !== "string" || !tz.trim() || tz.length > 80) {
    throw new HttpsError("invalid-argument", "Valid IANA time zone required.");
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz.trim() }).format();
  } catch {
    throw new HttpsError("invalid-argument", "Invalid IANA time zone format.");
  }
  return tz.trim();
}

/**
 * listManagedClasses
 * Input: {}
 * Output: { classes: [{ id, subject, code, room, ownerUid }] }
 */
exports.listManagedClasses = onCall(CALLABLE_OPTS, async (request) => {
  const { uid, role } = await requirePrivilegedCaller(request, ["teacher", "admin"]);
  const db = getFirestore();

  let query = db.collection("schoolClasses");
  if (role === "teacher") {
    query = query.where("ownerUid", "==", uid);
  }

  const snapshot = await query.get();
  const classes = snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      subject: d.subject || "",
      code: d.code || "",
      room: d.room || "",
      ownerUid: d.ownerUid || "",
      createdAt: d.createdAt ? d.createdAt.toDate().toISOString() : null,
    };
  });

  // Sort newest first
  classes.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  return {
    classes: classes.map(({ createdAt, ...item }) => item),
  };
});

/**
 * createClass
 * Input: { subject, code, room, requestId }
 * Output: { class: { id, subject, code, room, ownerUid } }
 */
exports.createClass = onCall(CALLABLE_OPTS, async (request) => {
  const { uid } = await requirePrivilegedCaller(request, ["teacher", "admin"]);
  const { subject, code, room, requestId } = request.data || {};

  const cleanSubject = typeof subject === "string" ? subject.trim() : "";
  const cleanCode = typeof code === "string" ? code.trim() : "";
  const cleanRoom = typeof room === "string" ? room.trim() : "";
  const cleanRequestId = typeof requestId === "string" ? requestId.trim().slice(0, 128) : null;

  if (!cleanSubject || cleanSubject.length > 120) {
    throw new HttpsError("invalid-argument", "Subject must be between 1 and 120 characters.");
  }
  if (!cleanCode || cleanCode.length > 40) {
    throw new HttpsError("invalid-argument", "Class code must be between 1 and 40 characters.");
  }
  if (cleanRoom.length > 120) {
    throw new HttpsError("invalid-argument", "Room cannot exceed 120 characters.");
  }

  const db = getFirestore();

  // Request deduplication
  if (cleanRequestId) {
    const existing = await db
      .collection("schoolClasses")
      .where("ownerUid", "==", uid)
      .where("requestId", "==", cleanRequestId)
      .limit(1)
      .get();

    if (!existing.empty) {
      const doc = existing.docs[0];
      const d = doc.data();
      return {
        class: {
          id: doc.id,
          subject: d.subject,
          code: d.code,
          room: d.room || "",
          ownerUid: d.ownerUid,
        },
      };
    }
  }

  const newDocRef = db.collection("schoolClasses").doc();
  const classData = {
    subject: cleanSubject,
    code: cleanCode,
    room: cleanRoom,
    ownerUid: uid,
    requestId: cleanRequestId,
    createdAt: FieldValue.serverTimestamp(),
  };

  await newDocRef.set(classData);

  return {
    class: {
      id: newDocRef.id,
      subject: cleanSubject,
      code: cleanCode,
      room: cleanRoom,
      ownerUid: uid,
    },
  };
});

/**
 * getManagedClass
 * Input: { classId }
 * Output: { class, students, sessions }
 */
exports.getManagedClass = onCall(CALLABLE_OPTS, async (request) => {
  const { uid, role } = await requirePrivilegedCaller(request, ["teacher", "admin"]);
  const { classId } = request.data || {};

  if (typeof classId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(classId)) {
    throw new HttpsError("invalid-argument", "Valid classId required.");
  }

  const db = getFirestore();
  const classRef = db.doc(`schoolClasses/${classId}`);
  const classSnap = await classRef.get();

  if (!classSnap.exists) {
    throw new HttpsError("not-found", "Class not found.");
  }

  const classData = classSnap.data();
  if (role === "teacher" && classData.ownerUid !== uid) {
    throw new HttpsError("permission-denied", "You are not authorized to view this class.");
  }

  // Active enrolled students
  const enrollmentsSnap = await classRef
    .collection("enrollments")
    .where("active", "==", true)
    .get();

  const students = enrollmentsSnap.docs.map((d) => {
    const ed = d.data();
    return {
      uid: d.id,
      name: ed.name || "",
      email: ed.email || "",
      studentId: ed.studentId || "",
    };
  });

  // Sessions for this class (never return token or tokenHash)
  const sessionsSnap = await db
    .collection("attendanceSessions")
    .where("classId", "==", classId)
    .get();

  const sessions = sessionsSnap.docs
    .map((d) => {
      const sd = d.data();
      const startsAt = sd.startsAt?.toDate ? sd.startsAt.toDate().toISOString() : "";
      const lateAfter = sd.lateAfter?.toDate ? sd.lateAfter.toDate().toISOString() : "";
      const endsAt = sd.endsAt?.toDate ? sd.endsAt.toDate().toISOString() : "";
      return {
        id: d.id,
        classId: sd.classId || classId,
        subject: sd.subject || classData.subject,
        startsAt,
        lateAfter,
        endsAt,
        timeZone: sd.timeZone || "Asia/Manila",
        closed: !!sd.closed,
      };
    })
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  return {
    class: {
      id: classSnap.id,
      subject: classData.subject || "",
      code: classData.code || "",
      room: classData.room || "",
      ownerUid: classData.ownerUid || "",
    },
    students,
    sessions,
  };
});

/**
 * enrollStudent
 * Input: { classId, email }
 * Output: { ok: true }
 */
exports.enrollStudent = onCall(CALLABLE_OPTS, async (request) => {
  const { uid, role } = await requirePrivilegedCaller(request, ["teacher", "admin"]);
  const { classId, email } = request.data || {};

  if (typeof classId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(classId)) {
    throw new HttpsError("invalid-argument", "Valid classId required.");
  }
  const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!cleanEmail || cleanEmail.length > 254 || !cleanEmail.includes("@")) {
    throw new HttpsError("invalid-argument", "Valid student email address required.");
  }

  const db = getFirestore();
  const classRef = db.doc(`schoolClasses/${classId}`);
  const classSnap = await classRef.get();

  if (!classSnap.exists) {
    throw new HttpsError("not-found", "Class not found.");
  }
  if (role === "teacher" && classSnap.data().ownerUid !== uid) {
    throw new HttpsError("permission-denied", "You do not own this class.");
  }

  // Look up student account privately via Admin SDK
  let studentAccount;
  try {
    studentAccount = await getAuth().getUserByEmail(cleanEmail);
  } catch (err) {
    throw new HttpsError(
      "not-found",
      "No registered student found with this email. The student must register first.",
    );
  }

  if (studentAccount.emailVerified !== true) {
    throw new HttpsError(
      "failed-precondition",
      "Student email is not verified yet. The student must verify their email before enrollment.",
    );
  }

  const studentRole = studentAccount.customClaims?.role || "student";
  if (studentRole !== "student") {
    throw new HttpsError(
      "failed-precondition",
      `Cannot enroll an account with '${studentRole}' role into a student roster.`,
    );
  }

  // Fetch student profile for name / studentId
  const profileSnap = await db.doc(`users/${studentAccount.uid}`).get();
  const profile = profileSnap.exists ? profileSnap.data() : {};
  const studentName = profile.name || studentAccount.displayName || cleanEmail;
  const studentId = profile.studentId || "";

  // Write active enrollment
  await classRef.collection("enrollments").doc(studentAccount.uid).set({
    uid: studentAccount.uid,
    email: studentAccount.email || cleanEmail,
    name: studentName,
    studentId: studentId,
    active: true,
    enrolledAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

/**
 * removeStudent
 * Input: { classId, uid }
 * Output: { ok: true }
 */
exports.removeStudent = onCall(CALLABLE_OPTS, async (request) => {
  const { uid: callerUid, role } = await requirePrivilegedCaller(request, [
    "teacher",
    "admin",
  ]);
  const { classId, uid: targetUid } = request.data || {};

  if (typeof classId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(classId)) {
    throw new HttpsError("invalid-argument", "Valid classId required.");
  }
  if (typeof targetUid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(targetUid)) {
    throw new HttpsError("invalid-argument", "Valid student UID required.");
  }

  const db = getFirestore();
  const classRef = db.doc(`schoolClasses/${classId}`);
  const classSnap = await classRef.get();

  if (!classSnap.exists) {
    throw new HttpsError("not-found", "Class not found.");
  }
  if (role === "teacher" && classSnap.data().ownerUid !== callerUid) {
    throw new HttpsError("permission-denied", "You do not own this class.");
  }

  // Deactivate enrollment immediately
  await classRef.collection("enrollments").doc(targetUid).set(
    {
      active: false,
      revokedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { ok: true };
});

/**
 * startAttendanceSession
 * Input: { classId, startsAt, lateAfter, endsAt, timeZone, requestId }
 * Output: { session, qrPayload }
 */
exports.startAttendanceSession = onCall(CALLABLE_OPTS, async (request) => {
  const { uid, role } = await requirePrivilegedCaller(request, ["teacher", "admin"]);
  const { classId, startsAt, lateAfter, endsAt, timeZone, requestId } =
    request.data || {};

  if (typeof classId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(classId)) {
    throw new HttpsError("invalid-argument", "Valid classId required.");
  }

  const cleanTz = validateTimeZone(timeZone);
  const start = new Date(startsAt);
  const late = new Date(lateAfter);
  const end = new Date(endsAt);

  if (
    !Number.isFinite(+start) ||
    !Number.isFinite(+late) ||
    !Number.isFinite(+end)
  ) {
    throw new HttpsError("invalid-argument", "Valid session start, late cutoff, and end times required.");
  }
  if (start >= end) {
    throw new HttpsError("invalid-argument", "Session end must be after start time.");
  }
  if (late < start || late > end) {
    throw new HttpsError("invalid-argument", "Late cutoff must be between start and end times.");
  }

  const maxDurationMs = 24 * 60 * 60 * 1000;
  if (end.getTime() - start.getTime() > maxDurationMs) {
    throw new HttpsError("invalid-argument", "Session duration cannot exceed 24 hours.");
  }

  const db = getFirestore();
  const classRef = db.doc(`schoolClasses/${classId}`);
  const classSnap = await classRef.get();

  if (!classSnap.exists) {
    throw new HttpsError("not-found", "Class not found.");
  }
  const classData = classSnap.data();
  if (role === "teacher" && classData.ownerUid !== uid) {
    throw new HttpsError("permission-denied", "You do not own this class.");
  }

  const cleanRequestId = typeof requestId === "string" ? requestId.trim().slice(0, 128) : null;

  // Generate cryptographically random token (at least 32 bytes)
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const sessionRef = db.collection("attendanceSessions").doc();
  const sessionDoc = {
    classId,
    subject: classData.subject,
    ownerUid: uid,
    startsAt: Timestamp.fromDate(start),
    lateAfter: Timestamp.fromDate(late),
    endsAt: Timestamp.fromDate(end),
    timeZone: cleanTz,
    closed: false,
    tokenHash,
    tokenVersion: 1,
    requestId: cleanRequestId,
    createdAt: FieldValue.serverTimestamp(),
  };

  await sessionRef.set(sessionDoc);

  return {
    session: {
      id: sessionRef.id,
      classId,
      subject: classData.subject,
      startsAt: start.toISOString(),
      lateAfter: late.toISOString(),
      endsAt: end.toISOString(),
      timeZone: cleanTz,
      closed: false,
    },
    qrPayload: {
      app: "StudentAttendance",
      v: 1,
      sessionId: sessionRef.id,
      token,
    },
  };
});

/**
 * rotateAttendanceQR
 * Input: { sessionId }
 * Output: { session, qrPayload }
 */
exports.rotateAttendanceQR = onCall(CALLABLE_OPTS, async (request) => {
  const { uid, role } = await requirePrivilegedCaller(request, ["teacher", "admin"]);
  const { sessionId } = request.data || {};

  if (typeof sessionId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(sessionId)) {
    throw new HttpsError("invalid-argument", "Valid sessionId required.");
  }

  const db = getFirestore();
  const sessionRef = db.doc(`attendanceSessions/${sessionId}`);

  return db.runTransaction(async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    if (!sessionSnap.exists) {
      throw new HttpsError("not-found", "Attendance session not found.");
    }

    const s = sessionSnap.data();
    if (role === "teacher" && s.ownerUid && s.ownerUid !== uid) {
      throw new HttpsError("permission-denied", "You do not own this session.");
    }
    if (s.closed === true) {
      throw new HttpsError("failed-precondition", "Cannot rotate QR for a closed session.");
    }

    const now = new Date();
    const end = s.endsAt?.toDate ? s.endsAt.toDate() : new Date(0);
    if (now > end) {
      throw new HttpsError("failed-precondition", "Cannot rotate QR for an expired session.");
    }

    // Generate fresh cryptographically random token
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const newVersion = (s.tokenVersion || 1) + 1;

    transaction.update(sessionRef, {
      tokenHash,
      tokenVersion: newVersion,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      session: {
        id: sessionId,
        classId: s.classId || sessionId,
        subject: s.subject || "",
        startsAt: s.startsAt?.toDate ? s.startsAt.toDate().toISOString() : "",
        lateAfter: s.lateAfter?.toDate ? s.lateAfter.toDate().toISOString() : "",
        endsAt: s.endsAt?.toDate ? s.endsAt.toDate().toISOString() : "",
        timeZone: s.timeZone || "Asia/Manila",
        closed: false,
      },
      qrPayload: {
        app: "StudentAttendance",
        v: 1,
        sessionId,
        token,
      },
    };
  });
});

/**
 * closeAttendanceSession
 * Input: { sessionId }
 * Output: { ok: true }
 */
exports.closeAttendanceSession = onCall(CALLABLE_OPTS, async (request) => {
  const { uid, role } = await requirePrivilegedCaller(request, ["teacher", "admin"]);
  const { sessionId } = request.data || {};

  if (typeof sessionId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(sessionId)) {
    throw new HttpsError("invalid-argument", "Valid sessionId required.");
  }

  const db = getFirestore();
  const sessionRef = db.doc(`attendanceSessions/${sessionId}`);

  return db.runTransaction(async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    if (!sessionSnap.exists) {
      throw new HttpsError("not-found", "Attendance session not found.");
    }

    const s = sessionSnap.data();
    if (role === "teacher" && s.ownerUid && s.ownerUid !== uid) {
      throw new HttpsError("permission-denied", "You do not own this session.");
    }

    if (s.closed === true) {
      return { ok: true }; // Idempotent
    }

    transaction.update(sessionRef, {
      closed: true,
      closedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true };
  });
});

/**
 * markAttendance
 * Input: { sessionId, token }
 * Output: { sessionId, classId, subject, date, time, status, source }
 *
 * Compatible with existing student scanner.
 * Verifies live authoritative class enrollment, time range, closed status,
 * token hash, and duplicate checks transactionally.
 */
exports.markAttendance = onCall(CALLABLE_OPTS, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to record attendance.");
  }
  if (request.auth.token.email_verified !== true) {
    throw new HttpsError(
      "failed-precondition",
      "Verify your email before checking in.",
    );
  }

  const { sessionId, token } = request.data || {};
  if (
    typeof sessionId !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(sessionId) ||
    typeof token !== "string" ||
    !/^[A-Za-z0-9_-]{32,256}$/.test(token)
  ) {
    throw new HttpsError("invalid-argument", "Invalid attendance QR.");
  }

  const uid = request.auth.uid;
  const db = getFirestore();
  const sessionRef = db.doc(`attendanceSessions/${sessionId}`);
  const attendanceRef = db.doc(`users/${uid}/attendance/${sessionId}`);
  const userRef = db.doc(`users/${uid}`);

  return db.runTransaction(async (transaction) => {
    // 1. Fetch session doc first to determine classId
    const session = await transaction.get(sessionRef);
    if (!session.exists) {
      throw new HttpsError(
        "not-found",
        "This class session does not exist. Ask your instructor for a current QR.",
      );
    }

    const s = session.data();
    const now = new Date();
    const start = s.startsAt?.toDate ? s.startsAt.toDate() : null;
    const end = s.endsAt?.toDate ? s.endsAt.toDate() : null;
    const late = s.lateAfter?.toDate ? s.lateAfter.toDate() : null;

    if (
      !start ||
      !end ||
      !late ||
      !s.timeZone ||
      typeof s.subject !== "string" ||
      !/^[a-f0-9]{64}$/.test(s.tokenHash || "")
    ) {
      throw new HttpsError(
        "failed-precondition",
        "This session is not configured correctly. Contact the instructor.",
      );
    }

    if (s.closed === true || now < start || now > end) {
      throw new HttpsError(
        "failed-precondition",
        "Attendance is not open for this session.",
      );
    }

    // 2. Token verification with timingSafeEqual
    const actual = createHash("sha256").update(token).digest();
    const expected = Buffer.from(s.tokenHash, "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new HttpsError(
        "permission-denied",
        "This QR is invalid or has been replaced.",
      );
    }

    // 3. Fetch enrollment and existing record
    let enrollmentDoc;
    if (s.classId) {
      const classEnrollmentRef = db.doc(`schoolClasses/${s.classId}/enrollments/${uid}`);
      enrollmentDoc = await transaction.get(classEnrollmentRef);
    } else {
      const sessionEnrollmentRef = sessionRef.collection("enrollments").doc(uid);
      enrollmentDoc = await transaction.get(sessionEnrollmentRef);
    }

    const [existing, profile] = await Promise.all([
      transaction.get(attendanceRef),
      transaction.get(userRef),
    ]);

    // Check enrollment
    if (!enrollmentDoc.exists || enrollmentDoc.data().active !== true) {
      throw new HttpsError(
        "permission-denied",
        "You are not enrolled in this class session. Ask your instructor.",
      );
    }

    // Transactional duplicate check
    if (existing.exists) {
      throw new HttpsError(
        "already-exists",
        "Already checked in. Your attendance for this session is saved.",
      );
    }

    // Format local date and time using session timeZone
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: s.timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(now)
        .map((p) => [p.type, p.value]),
    );

    const record = {
      sessionId,
      classId: s.classId || sessionId,
      subject: s.subject,
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}`,
      status: now > late ? "Late" : "Present",
      source: "School verified",
      createdAt: FieldValue.serverTimestamp(),
    };

    transaction.create(attendanceRef, record);

    if (profile.data()?.settings?.notifications !== false) {
      transaction.create(db.doc(`users/${uid}/notifications/${sessionId}`), {
        title: "Attendance confirmed",
        body: `${record.subject} • ${record.date} ${record.time} • ${record.status}`,
        kind: "confirmation",
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    const { createdAt, ...result } = record;
    return result;
  });
});
