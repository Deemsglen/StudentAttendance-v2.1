// Administrative CLI only. Requires trusted Application Default Credentials.
// Never bundle service-account keys or this admin capability in the client UI.
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { randomBytes, createHash } = require("node:crypto");
(async () => {
  const [
    projectId,
    subject,
    classId,
    startISO,
    endISO,
    lateISO,
    timeZone,
    ...uids
  ] = process.argv.slice(2);
  if (
    !projectId ||
    !subject ||
    !classId ||
    !startISO ||
    !endISO ||
    !lateISO ||
    !timeZone ||
    !uids.length
  )
    throw Error(
      'Usage: node scripts/create-session.cjs PROJECT "SUBJECT" CLASS_ID START_ISO END_ISO LATE_AFTER_ISO TIME_ZONE UID [UID...]',
    );
  const startsAt = new Date(startISO),
    endsAt = new Date(endISO),
    lateAfter = new Date(lateISO);
  if (
    !Number.isFinite(+startsAt) ||
    !Number.isFinite(+endsAt) ||
    !Number.isFinite(+lateAfter) ||
    startsAt >= endsAt ||
    lateAfter < startsAt ||
    lateAfter > endsAt
  )
    throw Error("Invalid dates or late cutoff.");
  new Intl.DateTimeFormat("en", { timeZone }).format(startsAt);
  if (uids.length > 400 || uids.some((uid) => !uid || uid.includes("/")))
    throw Error("Use 1–400 valid Firebase UIDs per session.");
  initializeApp({ credential: applicationDefault(), projectId });
  const db = getFirestore(),
    ref = db.collection("attendanceSessions").doc(),
    token = randomBytes(32).toString("base64url"),
    batch = db.batch();
  batch.create(ref, {
    subject,
    classId,
    startsAt: Timestamp.fromDate(startsAt),
    endsAt: Timestamp.fromDate(endsAt),
    lateAfter: Timestamp.fromDate(lateAfter),
    timeZone,
    closed: false,
    tokenHash: createHash("sha256").update(token).digest("hex"),
  });
  for (const uid of new Set(uids))
    batch.create(ref.collection("enrollments").doc(uid), { active: true });
  await batch.commit();
  console.log(
    JSON.stringify({
      app: "StudentAttendance",
      v: 1,
      sessionId: ref.id,
      token,
    }),
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
