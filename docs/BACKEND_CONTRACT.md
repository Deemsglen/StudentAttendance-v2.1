# Student Attendance 2.1 — Teacher/Admin API contract

Status: Fully implemented and verified in functions/index.js with server-side revocation checks, live class membership verification, and trusted administrative role management CLI.

## Identity and authorization
Firebase Auth ID-token custom claim `role` is exactly `student`, `teacher` or `admin`; missing/unknown means student. The frontend reads claims separately from the editable profile. Require verified email for management and attendance. Only trusted Admin SDK provisioning may grant teacher/admin. Registration never grants privileges. A user writing `role` in their profile must confer no access. Bootstrap the first admin with an audited trusted CLI (never public signup). Server authorization is mandatory even though routes are gated.

## Transport
Use Firebase HTTPS callable functions in VITE_FIREBASE_FUNCTIONS_REGION (default asia-southeast1). Input/output is the data object, not the callable HTTP envelope. Return typed errors using HttpsError. Client error/loading/empty states already exist; missing services fail visibly rather than saving fake local data. Never return success before the transaction commits. Create/session issuance should accept a client requestId and deduplicate retries. Every management list/detail response must be scoped to the authenticated teacher's owned classes; admins may manage all. No public user lookup API.

## Exact callable names and shapes
- `listManagedClasses({})` → `{classes:[{id,subject,code,room,ownerUid}]}`.
- `createClass({subject,code,room,requestId})` → `{class:{id,subject,code,room,ownerUid}}`. Teacher owner is always caller UID; no client-chosen owner. Admin ownership assignment, if needed, is a separate explicitly authorized operation.
- `getManagedClass({classId})` → `{class:{id,subject,code,room,ownerUid}, students:[{uid,name,email,studentId}], sessions:[{id,classId,subject,startsAt,lateAfter,endsAt,timeZone,closed}]}`. Date strings ISO 8601 instants. Students are active enrolled members only. Sessions sorted newest-first. Never include token/tokenHash in this response. Add pagination to UI and API together if lists are bounded; never silently truncate.
- `enrollStudent({classId,email})` → `{ok:true}`. Resolve exact email privately via Admin SDK; require registered verified student, reject wrong role, never auto-create a user or disclose unrelated profiles. Idempotent active enrollment.
- `removeStudent({classId,uid})` → `{ok:true}`. Revoke current enrollment immediately including active sessions; do not delete attendance history. Idempotent revocation.
- `startAttendanceSession({classId,startsAt,lateAfter,endsAt,timeZone,requestId})` → `{session:{id,classId,subject,startsAt,lateAfter,endsAt,timeZone,closed:false}, qrPayload:{app:'StudentAttendance',v:1,sessionId:id,token}}`.
- `rotateAttendanceQR({sessionId})` → same shape as start. Owner/admin only; reject closed/expired sessions. Old token stops working atomically; attendance remains. Never recover an old token from localStorage. Define and test concurrent rotations: latest committed token wins.
- `closeAttendanceSession({sessionId})` → `{ok:true}`. Idempotent, owner/admin only; invalidates all subsequent check-ins immediately. Do not delete prior attendance.
- Existing `markAttendance({sessionId,token})` → `{sessionId,classId,subject,date,time,status,source}`. Keep compatible with existing student scanner. Server verifies identity, verified email, current active enrollment, class/session existence, token, start/end/late cutoff, closed flag and duplicates transactionally. Never trust client status/time/class/UID.

## Data / trust boundary
Suggested `schoolClasses/{classId}` ownerUid/subject/code/room/createdAt; private memberships under schoolClasses/{classId}/enrollments/{uid}. Existing `attendanceSessions/{id}` fields: classId, subject, startsAt/endsAt/lateAfter as Firestore Timestamp, timeZone, tokenHash, closed; add ownerUid, createdAt, tokenVersion. Cryptographically random >=32-byte token (base64url), SHA-256 stored server-only. QR token exists only in callable response/client memory. Do not put QR tokens in URL, logs, analytics or localStorage. Do not expose raw private session docs to students.

Current reference markAttendance uses attendanceSessions/{id}/enrollments/{uid}. Codex must update it to check authoritative live class membership (or transactional propagation with a tested revocation guarantee). Personal users/{uid}/subjects are timetable entries only, NOT school enrollment. Prevent checks while concurrently closing, rotating or revoking membership by reading authoritative docs inside the same transaction. Freeze subject/session metadata from the trusted class, not a caller-supplied subject.

Never mark students absent just because they have no scan; a school-authorized finalized roster/session policy is required. Preserve existing Present/Late behavior. Immutable server-created history under users/{uid}/attendance/{sessionId}; notification subject/status derive from the committed record. Respect notification preference without affecting attendance commit.

## Time and deployment
Datetime-local input is converted from device local time to ISO instants. `timeZone` is an IANA record-display zone, not a reinterpretation of those instants. Validate zones, chronology, maximum duration, scheduling bounds and class policy on the server. Client validation is only UX.

Configure Auth, Firestore rules/indexes, Functions, email verification/recovery, Android Google credentials and App Check/rate limits appropriate for the deployed clients. Google OAuth/native Firebase setup remains required. Never deploy an emulator-only or allow-all rules build. Service-account keys and OAuth secrets never belong in VITE_* or the app bundle.

Privilege revocation must not depend solely on the old ID-token role. Check token revocation/current trusted role on privileged server calls (e.g. verified/revocation-checked bearer token plus current Auth custom claims) so an already-issued teacher/admin token cannot retain privileges after removal. Document latency and fail closed. Firebase callable auth validation alone is not a complete revocation policy.
