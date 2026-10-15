#!/usr/bin/env node
// Trusted Administrative CLI to provision admin and assign/remove teacher roles.
// Requires Application Default Credentials (ADC) or service account credentials.
// Never bundle this file, admin keys, or escalation endpoints into the client APK.

const { initializeApp, applicationDefault, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

(async () => {
  const [projectId, email, roleArg] = process.argv.slice(2);

  if (!projectId || !email || !roleArg) {
    console.error("Usage: node scripts/manage-roles.cjs <PROJECT_ID> <USER_EMAIL> <ROLE>");
    console.error("  ROLE: 'admin' | 'teacher' | 'student' | 'get'");
    process.exit(1);
  }

  const role = roleArg.toLowerCase().trim();
  const allowedRoles = ["admin", "teacher", "student", "get"];
  if (!allowedRoles.includes(role)) {
    console.error(`Invalid role: '${roleArg}'. Must be one of: admin, teacher, student, get.`);
    process.exit(1);
  }

  if (!getApps().length) {
    initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }

  const auth = getAuth();
  const db = getFirestore();

  console.log(`Resolving user by email: ${email}...`);
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email.toLowerCase().trim());
  } catch (err) {
    console.error(`User not found: ${err.message}`);
    process.exit(1);
  }

  const currentClaims = userRecord.customClaims || {};
  const previousRole = currentClaims.role || "student";

  if (role === "get") {
    console.log("-----------------------------------------");
    console.log(`UID:           ${userRecord.uid}`);
    console.log(`Email:         ${userRecord.email}`);
    console.log(`Email Verified: ${userRecord.emailVerified}`);
    console.log(`Current Role:  ${previousRole}`);
    console.log(`Custom Claims:`, currentClaims);
    console.log(`Tokens Valid After: ${userRecord.tokensValidAfterTime || "None"}`);
    console.log("-----------------------------------------");
    return;
  }

  console.log(`Current role for ${email} (${userRecord.uid}): '${previousRole}'`);
  console.log(`Updating role to: '${role}'...`);

  // Preserve any other custom claims
  const newClaims = { ...currentClaims };
  if (role === "student") {
    delete newClaims.role;
  } else {
    newClaims.role = role;
  }

  await auth.setCustomUserClaims(userRecord.uid, newClaims);

  // If removing teacher/admin privileges or changing role, revoke refresh tokens immediately.
  let tokensRevoked = false;
  if (previousRole !== role) {
    await auth.revokeRefreshTokens(userRecord.uid);
    tokensRevoked = true;
    console.log(`Revoked existing refresh tokens for ${userRecord.uid}.`);
  }

  // Audit log in Firestore
  try {
    await db.collection("auditLogs").add({
      action: "SET_ROLE",
      targetUid: userRecord.uid,
      targetEmail: userRecord.email,
      previousRole,
      newRole: role,
      revokedTokens: tokensRevoked,
      timestamp: FieldValue.serverTimestamp(),
      caller: process.env.USERNAME || process.env.USER || "CLI_ADMIN",
    });
    console.log("Audit record written to Firestore 'auditLogs' collection.");
  } catch (auditErr) {
    console.warn(`Note: Could not write audit log doc: ${auditErr.message}`);
  }

  console.log("-----------------------------------------------------------------");
  console.log(`SUCCESS: User ${userRecord.email} is now assigned role '${role}'.`);
  if (tokensRevoked) {
    console.log("Server callable checks will reject previous session tokens immediately.");
    console.log("The user must refresh their token (e.g. via refreshAccess()) to obtain new claims.");
  }
  console.log("-----------------------------------------------------------------");
})().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
