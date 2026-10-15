const express = require("express");
const cors = require("cors");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { createHash, randomBytes, timingSafeEqual } = require("node:crypto");

if (!getApps().length) {
  initializeApp();
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const db = getFirestore();

// ─── Auth Middleware ───────────────────────────────────────────────

async function requirePrivilegedCaller(req, res, allowedRoles = ["teacher", "admin"]) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthenticated", message: "Sign in required to access this service." });
    return null;
  }

  const idToken = authHeader.split("Bearer ")[1];
  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(idToken);
  } catch (err) {
    res.status(401).json({ error: "unauthenticated", message: "Invalid or expired token." });
    return null;
  }

  if (decodedToken.email_verified !== true) {
    res.status(412).json({ error: "failed-precondition", message: "Verify your email before accessing this service." });
    return null;
  }

  const uid = decodedToken.uid;
  const authAdmin = getAuth();
  let userRecord;
  try {
    userRecord = await authAdmin.getUser(uid);
  } catch (err) {
    res.status(403).json({ error: "permission-denied", message: "User account not found or inaccessible." });
    return null;
  }

  if (userRecord.disabled) {
    res.status(403).json({ error: "permission-denied", message: "Account has been disabled." });
    return null;
  }

  if (userRecord.tokensValidAfterTime) {
    const validAfterSeconds = Math.floor(new Date(userRecord.tokensValidAfterTime).getTime() / 1000);
    const authTime = decodedToken.auth_time || decodedToken.iat || 0;
    if (authTime < validAfterSeconds) {
      res.status(403).json({ error: "permission-denied", message: "Session credentials have been revoked. Please sign in again." });
      return null;
    }
  }

  const currentRole = userRecord.customClaims?.role || "student";
  if (!allowedRoles.includes(currentRole)) {
    res.status(403).json({ error: "permission-denied", message: "Only an authorized teacher or administrator can perform this action." });
    return null;
  }

  return { uid, role: currentRole, userRecord };
}

async function requireAuth(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthenticated", message: "Sign in to record attendance." });
    return null;
  }

  const idToken = authHeader.split("Bearer ")[1];
  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(idToken);
  } catch (err) {
    res.status(401).json({ error: "unauthenticated", message: "Invalid or expired token." });
    return null;
  }

  if (decodedToken.email_verified !== true) {
    res.status(412).json({ error: "failed-precondition", message: "Verify your email before checking in." });
    return null;
  }

  return { uid: decodedToken.uid, token: decodedToken };
}

// ─── Helpers ───────────────────────────────────────────────────────

function validateTimeZone(tz) {
  if (typeof tz !== "string" || !tz.trim() || tz.length > 80) {
    return null;
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz.trim() }).format();
  } catch {
    return null;
  }
  return tz.trim();
}

// ─── API Endpoints ─────────────────────────────────────────────────

// 1. listManagedClasses
app.post("/api/listManagedClasses", async (req, res) => {
  try {
    const auth = await requirePrivilegedCaller(req, res, ["teacher", "admin"]);
    if (!auth) return;
    const { uid, role } = auth;

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

    classes.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    res.json({ classes: classes.map(({ createdAt, ...item }) => item) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal", message: "Internal server error." });
  }
});

// 2. createClass
app.post("/api/createClass", async (req, res) => {
  try {
    const auth = await requirePrivilegedCaller(req, res, ["teacher", "admin"]);
    if (!auth) return;
    const { uid } = auth;
    const { subject, code, room, requestId } = req.body || {};

    const cleanSubject = typeof subject === "string" ? subject.trim() : "";
    const cleanCode = typeof code === "string" ? code.trim() : "";
    const cleanRoom = typeof room === "string" ? room.trim() : "";
    const cleanRequestId = typeof requestId === "string" ? requestId.trim().slice(0, 128) : null;

    if (!cleanSubject || cleanSubject.length > 120) {
      return res.status(400).json({ error: "invalid-argument", message: "Subject must be between 1 and 120 characters." });
    }
    if (!cleanCode || cleanCode.length > 40) {
      return res.status(400).json({ error: "invalid-argument", message: "Class code must be between 1 and 40 characters." });
    }
    if (cleanRoom.length > 120) {
      return res.status(400).json({ error: "invalid-argument", message: "Room cannot exceed 120 characters." });
    }

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
        return res.json({
          class: { id: doc.id, subject: d.subject, code: d.code, room: d.room || "", ownerUid: d.ownerUid },
        });
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
    res.json({
      class: { id: newDocRef.id, subject: cleanSubject, code: cleanCode, room: cleanRoom, ownerUid: uid },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal", message: "Internal server error." });
  }
});

// 3. getManagedClass
app.post("/api/getManagedClass", async (req, res) => {
  try {
    const auth = await requirePrivilegedCaller(req, res, ["teacher", "admin"]);
    if (!auth) return;
    const { uid, role } = auth;
    const { classId } = req.body || {};

    if (typeof classId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(classId)) {
      return res.status(400).json({ error: "invalid-argument", message: "Valid classId required." });
    }

    const classRef = db.doc(`schoolClasses/${classId}`);
    const classSnap = await classRef.get();

    if (!classSnap.exists) {
      return res.status(404).json({ error: "not-found", message: "Class not found." });
    }

    const classData = classSnap.data();
    if (role === "teacher" && classData.ownerUid !== uid) {
      return res.status(403).json({ error: "permission-denied", message: "You are not authorized to view this class." });
    }

    const enrollmentsSnap = await classRef.collection("enrollments").where("active", "==", true).get();
    const students = enrollmentsSnap.docs.map((d) => {
      const ed = d.data();
      return { uid: d.id, name: ed.name || "", email: ed.email || "", studentId: ed.studentId || "" };
    });

    const sessionsSnap = await db.collection("attendanceSessions").where("classId", "==", classId).get();
    const sessions = sessionsSnap.docs
      .map((d) => {
        const sd = d.data();
        return {
          id: d.id,
          classId: sd.classId || classId,
          subject: sd.subject || classData.subject,
          startsAt: sd.startsAt?.toDate ? sd.startsAt.toDate().toISOString() : "",
          lateAfter: sd.lateAfter?.toDate ? sd.lateAfter.toDate().toISOString() : "",
          endsAt: sd.endsAt?.toDate ? sd.endsAt.toDate().toISOString() : "",
          timeZone: sd.timeZone || "Asia/Manila",
          closed: !!sd.closed,
        };
      })
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt));

    res.json({
      class: {
        id: classSnap.id,
        subject: classData.subject || "",
        code: classData.code || "",
        room: classData.room || "",
        ownerUid: classData.ownerUid || "",
      },
      students,
      sessions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal", message: "Internal server error." });
  }
});

// 4. enrollStudent
app.post("/api/enrollStudent", async (req, res) => {
  try {
    const auth = await requirePrivilegedCaller(req, res, ["teacher", "admin"]);
    if (!auth) return;
    const { uid, role } = auth;
    const { classId, email } = req.body || {};

    if (typeof classId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(classId)) {
      return res.status(400).json({ error: "invalid-argument", message: "Valid classId required." });
    }
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!cleanEmail || cleanEmail.length > 254 || !cleanEmail.includes("@")) {
      return res.status(400).json({ error: "invalid-argument", message: "Valid student email address required." });
    }

    const classRef = db.doc(`schoolClasses/${classId}`);
    const classSnap = await classRef.get();

    if (!classSnap.exists) {
      return res.status(404).json({ error: "not-found", message: "Class not found." });
    }
    if (role === "teacher" && classSnap.data().ownerUid !== uid) {
      return res.status(403).json({ error: "permission-denied", message: "You do not own this class." });
    }

    let studentAccount;
    try {
      studentAccount = await getAuth().getUserByEmail(cleanEmail);
    } catch (err) {
      return res.status(404).json({ error: "not-found", message: "No registered student found with this email. The student must register first." });
    }

    if (studentAccount.emailVerified !== true) {
      return res.status(412).json({ error: "failed-precondition", message: "Student email is not verified yet. The student must verify their email before enrollment." });
    }

    const studentRole = studentAccount.customClaims?.role || "student";
    if (studentRole !== "student") {
      return res.status(412).json({ error: "failed-precondition", message: `Cannot enroll an account with '${studentRole}' role into a student roster.` });
    }

    const profileSnap = await db.doc(`users/${studentAccount.uid}`).get();
    const profile = profileSnap.exists ? profileSnap.data() : {};
    const studentName = profile.name || studentAccount.displayName || cleanEmail;
    const studentId = profile.studentId || "";

    await classRef.collection("enrollments").doc(studentAccount.uid).set({
      uid: studentAccount.uid,
      email: studentAccount.email || cleanEmail,
      name: studentName,
      studentId: studentId,
      active: true,
      enrolledAt: FieldValue.serverTimestamp(),
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal", message: "Internal server error." });
  }
});

// 5. removeStudent
app.post("/api/removeStudent", async (req, res) => {
  try {
    const auth = await requirePrivilegedCaller(req, res, ["teacher", "admin"]);
    if (!auth) return;
    const { uid: callerUid, role } = auth;
    const { classId, uid: targetUid } = req.body || {};

    if (typeof classId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(classId)) {
      return res.status(400).json({ error: "invalid-argument", message: "Valid classId required." });
    }
    if (typeof targetUid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(targetUid)) {
      return res.status(400).json({ error: "invalid-argument", message: "Valid student UID required." });
    }

    const classRef = db.doc(`schoolClasses/${classId}`);
    const classSnap = await classRef.get();

    if (!classSnap.exists) {
      return res.status(404).json({ error: "not-found", message: "Class not found." });
    }
    if (role === "teacher" && classSnap.data().ownerUid !== callerUid) {
      return res.status(403).json({ error: "permission-denied", message: "You do not own this class." });
    }

    await classRef.collection("enrollments").doc(targetUid).set(
      { active: false, revokedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal", message: "Internal server error." });
  }
});

// 6. startAttendanceSession
app.post("/api/startAttendanceSession", async (req, res) => {
  try {
    const auth = await requirePrivilegedCaller(req, res, ["teacher", "admin"]);
    if (!auth) return;
    const { uid, role } = auth;
    const { classId, startsAt, lateAfter, endsAt, timeZone, requestId } = req.body || {};

    if (typeof classId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(classId)) {
      return res.status(400).json({ error: "invalid-argument", message: "Valid classId required." });
    }

    const cleanTz = validateTimeZone(timeZone);
    if (!cleanTz) {
      return res.status(400).json({ error: "invalid-argument", message: "Valid IANA time zone required." });
    }

    const start = new Date(startsAt);
    const late = new Date(lateAfter);
    const end = new Date(endsAt);

    if (!Number.isFinite(+start) || !Number.isFinite(+late) || !Number.isFinite(+end)) {
      return res.status(400).json({ error: "invalid-argument", message: "Valid session start, late cutoff, and end times required." });
    }
    if (start >= end) {
      return res.status(400).json({ error: "invalid-argument", message: "Session end must be after start time." });
    }
    if (late < start || late > end) {
      return res.status(400).json({ error: "invalid-argument", message: "Late cutoff must be between start and end times." });
    }

    const maxDurationMs = 24 * 60 * 60 * 1000;
    if (end.getTime() - start.getTime() > maxDurationMs) {
      return res.status(400).json({ error: "invalid-argument", message: "Session duration cannot exceed 24 hours." });
    }

    const classRef = db.doc(`schoolClasses/${classId}`);
    const classSnap = await classRef.get();

    if (!classSnap.exists) {
      return res.status(404).json({ error: "not-found", message: "Class not found." });
    }
    const classData = classSnap.data();
    if (role === "teacher" && classData.ownerUid !== uid) {
      return res.status(403).json({ error: "permission-denied", message: "You do not own this class." });
    }

    const cleanRequestId = typeof requestId === "string" ? requestId.trim().slice(0, 128) : null;
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

    res.json({
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
      qrPayload: { app: "StudentAttendance", v: 1, sessionId: sessionRef.id, token },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal", message: "Internal server error." });
  }
});

// 7. rotateAttendanceQR
app.post("/api/rotateAttendanceQR", async (req, res) => {
  try {
    const auth = await requirePrivilegedCaller(req, res, ["teacher", "admin"]);
    if (!auth) return;
    const { uid, role } = auth;
    const { sessionId } = req.body || {};

    if (typeof sessionId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(sessionId)) {
      return res.status(400).json({ error: "invalid-argument", message: "Valid sessionId required." });
    }

    const sessionRef = db.doc(`attendanceSessions/${sessionId}`);

    try {
      const result = await db.runTransaction(async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef);
        if (!sessionSnap.exists) {
          throw { status: 404, error: "not-found", message: "Attendance session not found." };
        }

        const s = sessionSnap.data();
        if (role === "teacher" && s.ownerUid && s.ownerUid !== uid) {
          throw { status: 403, error: "permission-denied", message: "You do not own this session." };
        }
        if (s.closed === true) {
          throw { status: 412, error: "failed-precondition", message: "Cannot rotate QR for a closed session." };
        }

        const now = new Date();
        const end = s.endsAt?.toDate ? s.endsAt.toDate() : new Date(0);
        if (now > end) {
          throw { status: 412, error: "failed-precondition", message: "Cannot rotate QR for an expired session." };
        }

        const token = randomBytes(32).toString("base64url");
        const tokenHash = createHash("sha256").update(token).digest("hex");
        const newVersion = (s.tokenVersion || 1) + 1;

        transaction.update(sessionRef, { tokenHash, tokenVersion: newVersion, updatedAt: FieldValue.serverTimestamp() });

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
          qrPayload: { app: "StudentAttendance", v: 1, sessionId, token },
        };
      });

      res.json(result);
    } catch (txnErr) {
      if (txnErr.status) {
        return res.status(txnErr.status).json({ error: txnErr.error, message: txnErr.message });
      }
      throw txnErr;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal", message: "Internal server error." });
  }
});

// 8. closeAttendanceSession
app.post("/api/closeAttendanceSession", async (req, res) => {
  try {
    const auth = await requirePrivilegedCaller(req, res, ["teacher", "admin"]);
    if (!auth) return;
    const { uid, role } = auth;
    const { sessionId } = req.body || {};

    if (typeof sessionId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(sessionId)) {
      return res.status(400).json({ error: "invalid-argument", message: "Valid sessionId required." });
    }

    const sessionRef = db.doc(`attendanceSessions/${sessionId}`);

    try {
      await db.runTransaction(async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef);
        if (!sessionSnap.exists) {
          throw { status: 404, error: "not-found", message: "Attendance session not found." };
        }

        const s = sessionSnap.data();
        if (role === "teacher" && s.ownerUid && s.ownerUid !== uid) {
          throw { status: 403, error: "permission-denied", message: "You do not own this session." };
        }
        if (s.closed === true) {
          return; // Idempotent
        }

        transaction.update(sessionRef, { closed: true, closedAt: FieldValue.serverTimestamp() });
      });

      res.json({ ok: true });
    } catch (txnErr) {
      if (txnErr.status) {
        return res.status(txnErr.status).json({ error: txnErr.error, message: txnErr.message });
      }
      throw txnErr;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal", message: "Internal server error." });
  }
});

// 9. markAttendance
app.post("/api/markAttendance", async (req, res) => {
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const { uid } = auth;
    const { sessionId, token } = req.body || {};

    if (
      typeof sessionId !== "string" ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(sessionId) ||
      typeof token !== "string" ||
      !/^[A-Za-z0-9_-]{32,256}$/.test(token)
    ) {
      return res.status(400).json({ error: "invalid-argument", message: "Invalid attendance QR." });
    }

    const sessionRef = db.doc(`attendanceSessions/${sessionId}`);
    const attendanceRef = db.doc(`users/${uid}/attendance/${sessionId}`);
    const userRef = db.doc(`users/${uid}`);

    try {
      const result = await db.runTransaction(async (transaction) => {
        const session = await transaction.get(sessionRef);
        if (!session.exists) {
          throw { status: 404, error: "not-found", message: "This class session does not exist. Ask your instructor for a current QR." };
        }

        const s = session.data();
        const now = new Date();
        const start = s.startsAt?.toDate ? s.startsAt.toDate() : null;
        const end = s.endsAt?.toDate ? s.endsAt.toDate() : null;
        const late = s.lateAfter?.toDate ? s.lateAfter.toDate() : null;

        if (!start || !end || !late || !s.timeZone || typeof s.subject !== "string" || !/^[a-f0-9]{64}$/.test(s.tokenHash || "")) {
          throw { status: 412, error: "failed-precondition", message: "This session is not configured correctly. Contact the instructor." };
        }

        if (s.closed === true || now < start || now > end) {
          throw { status: 412, error: "failed-precondition", message: "Attendance is not open for this session." };
        }

        const actual = createHash("sha256").update(token).digest();
        const expected = Buffer.from(s.tokenHash, "hex");
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
          throw { status: 403, error: "permission-denied", message: "This QR is invalid or has been replaced." };
        }

        let enrollmentDoc;
        if (s.classId) {
          enrollmentDoc = await transaction.get(db.doc(`schoolClasses/${s.classId}/enrollments/${uid}`));
        } else {
          enrollmentDoc = await transaction.get(sessionRef.collection("enrollments").doc(uid));
        }

        const [existing, profile] = await Promise.all([
          transaction.get(attendanceRef),
          transaction.get(userRef),
        ]);

        if (!enrollmentDoc.exists || enrollmentDoc.data().active !== true) {
          throw { status: 403, error: "permission-denied", message: "You are not enrolled in this class session. Ask your instructor." };
        }

        if (existing.exists) {
          throw { status: 409, error: "already-exists", message: "Already checked in. Your attendance for this session is saved." };
        }

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
            .map((p) => [p.type, p.value])
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

        const { createdAt, ...rest } = record;
        return rest;
      });

      res.json(result);
    } catch (txnErr) {
      if (txnErr.status) {
        return res.status(txnErr.status).json({ error: txnErr.error, message: txnErr.message });
      }
      throw txnErr;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal", message: "Internal server error." });
  }
});

// ─── Health Check ──────────────────────────────────────────────────

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Start Server ──────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
