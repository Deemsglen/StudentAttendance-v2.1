# Connect Student Attendance 2.0 to real accounts

## Important status

The source implements Firebase email/password and Google authentication, private account data, and a trusted attendance-verification function. **No live Firebase project, OAuth client, school roster or credentials were supplied.** The supplied setup APK therefore displays an explicit setup-required notice; it does NOT offer demo login, fake Google login or invented account creation. Complete this document and rebuild before using real accounts. No cloud resources have been created or deployed by the assistant.

The original v1 project is backed up separately. Existing old LocalStorage records are not deleted, uploaded, or silently attached to a real identity. They are ignored by v2. If you want to purge old device-only data, export it first, then clear app storage yourself; that action cannot be undone.

## 1. Create or choose your own Firebase project

In the Firebase Console, create/choose the project you control. Never send a service-account private key, admin credential, account password, or signing keystore in chat or commit it into this project.

1. Register a Web app in Project Settings.
2. Copy `.env.example` to `.env.local` in the **AbsenSiswa project root**, beside package.json.
3. Fill the four public Web configuration values from that app's Firebase configuration:

```dotenv
VITE_FIREBASE_API_KEY=<your public Firebase Web API key>
VITE_FIREBASE_AUTH_DOMAIN=<your project auth domain>
VITE_FIREBASE_PROJECT_ID=<your project ID>
VITE_FIREBASE_APP_ID=<your Firebase Web app ID>
VITE_FIREBASE_FUNCTIONS_REGION=asia-southeast1
VITE_NATIVE_GOOGLE_ENABLED=false
VITE_USE_EMULATORS=false
```

These are public client configuration, NOT admin secrets. Rules and server-side authorization protect data; obscuring the API key does not. Do not paste angle-bracket placeholders literally. Restart Vite after changing env files. Vite injects this configuration at build time, so an existing APK cannot be enabled merely by editing a text file on a phone.

## 2. Enable real authentication

In Authentication > Sign-in method:
- Enable Email/Password.
- Enable Google and choose the required project support email.
- Configure password policy (the UI requires 12+ characters for new passwords).
- Configure your verification and password-reset email templates and authorized web domains. Add localhost for local browser development; add your real hosted domain if you deploy the web version.

Registration sends an email verification request. Sign-in is email-based (not a locally looked-up student ID). The student ID and course are self-reported profile information, not school-verified identity. Passwords are handled by Firebase Auth and are never written into Firestore/LocalStorage by v2. Password strength is advisory; server password policy remains authoritative.

Google users complete their own profile/course/student ID after first sign-in. A Google-only user manages their Google password through Google; the app does not pretend to change it.

## 3. Create Firestore and deploy access rules

Create a Cloud Firestore database in the console. Do NOT leave it in open/test mode. Install the Firebase CLI on your own development machine and sign in there:

```powershell
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes
```

Select your actual project when prompted. Review the included rules before deploying. Each user can only read their own profile, personal subjects, attendance and notifications. The client cannot create attendance or notifications; the trusted backend does that. User-managed subjects never grant school enrollment.

Cloud operations require a network connection. The UI waits for server confirmation and surfaces errors; it does not claim a save succeeded while offline. This version does not enable persistent offline Firestore caching.

## 4. Configure native Android Google login

The Android application ID remains `com.deemsglen.absensiswa` for update compatibility.

1. In the same Firebase project, register an Android app with that exact ID.
2. From the android directory, obtain the SHA fingerprints for the key you actually use:

```powershell
.\gradlew.bat :app:signingReport
```

3. Register the debug SHA-1 / SHA-256 (and later the release/Play signing fingerprints) in the Android app's Firebase settings.
4. With Google provider enabled, download the updated `google-services.json` and place it at:

```text
AbsenSiswa/android/app/google-services.json
```

5. Confirm the JSON contains the Google OAuth client configuration for this app, including the Web client used for the ID-token audience. Do not substitute an arbitrary OAuth client ID.
6. Set `VITE_NATIVE_GOOGLE_ENABLED=true` in `.env.local`.
7. Rebuild and sync:

```powershell
npm ci
npm run build
npx cap sync android
npx cap open android
```

The config includes the native Firebase Authentication plugin only when that real JSON file exists. This avoids initializing an unconfigured native Firebase SDK in a setup-only APK. `rgcfaIncludeGoogle=true` is already set in android/variables.gradle. The app requests a native Google identity token and then signs in to Firebase's JS Auth session; it does NOT open Google's login page inside an embedded WebView.

Native Google consent/token issuance was not tested against a live project or on a phone here. Test it after your configuration is installed. Web development uses Firebase's Google popup flow; popup/domain configuration errors are shown instead of fabricating a login.

## 5. Deploy trusted attendance verification

Email and schedule/profile features do not require Cloud Functions; school-issued QR attendance does.

```powershell
cd functions
npm ci
cd ..
firebase deploy --only functions:markAttendance
```

Function deployment can require billing/service configuration in your Firebase project; review the Firebase Console requirements and costs before enabling/deploying. No deployment or billing change has been performed here. The client region and function region are both `asia-southeast1`; change both if you intentionally choose a different region.

`markAttendance` requires:
- An authenticated user with verified email.
- A school-created session within its server-side opening/closing time.
- A matching unpredictable QR token, whose SHA-256 hash is stored privately.
- An active, administrator-created enrollment entry for that UID/session.
- No prior attendance for that UID/session (transactional duplicate rejection).

Personal timetable entries cannot bypass any of these checks. No fake/manual demo attendance is offered. Present/Late is calculated by the server using the school's explicit cutoff. There is no automatic Absent calculation in this version: only a trusted school process can add absent records. The dashboard's denominator is recorded attendance sessions, not every timetable entry.

### Trusted school administrator session creation

A small **administrative CLI** is included at `functions/scripts/create-session.cjs`. It requires trusted Application Default Credentials on the administrator's own machine/cloud environment, never inside the APK. Do not distribute admin keys to students.

Usage (all session policy values must be supplied by the school):

```text
node scripts/create-session.cjs PROJECT_ID "SUBJECT" CLASS_ID START_ISO END_ISO LATE_AFTER_ISO IANA_TIMEZONE FIREBASE_UID [FIREBASE_UID...]
```

Run from `functions/` after its npm install. Times must be unambiguous ISO timestamps with timezone offsets. It creates the session/enrollment records, and outputs a QR payload to encode and display to the enrolled class. For larger rosters, use a school-controlled enrollment workflow rather than exposing this capability to students.

Payload format:

```json
{"app":"StudentAttendance","v":1,"sessionId":"<school session ID>","token":"<server-created random token>"}
```

Do not reuse old v1 demonstration QR codes. They are rejected. Session QR codes remain copyable while open: this protects authorization and duplicate handling, but is not location/anti-proxy proof. Before wider production use, review App Check/device attestation, abuse controls, logs, retention, budgets and your school's privacy requirements. This is not a claim of a completed institutional security audit.

## 6. Build and test on a real phone

With your real configuration in place:

```powershell
npm run build
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

Test email registration, verification, sign-in, password reset/change, native Google login, cross-account data isolation, photo upload, personal schedule save/reload, OCR permission/error handling and an actual school-issued QR. Verify camera release, Android system bars/back gestures and share-sheet CSV export on your phone. Do not uninstall an existing app just to update; signing-key mismatch requires a deliberate migration/backup decision.

## Development-only emulator testing

`firebase.json` defines Auth 9099, Firestore 8080 and Functions 5001. Emulators were used locally to verify code without making real accounts or cloud changes. The `VITE_USE_EMULATORS=true` toggle is honored only by Vite development mode, never by a production build. Test-only credentials and records are not seeded into the APK. See verification-v2 for actual test evidence.
