# Student Attendance 2.1

React + Vite + JavaScript/JSX + Tailwind CSS, packaged into a native Android Studio project using Capacitor. App ID remains `com.deemsglen.absensiswa`. This is not a Compose UI or a website-only deliverable.

## Read this first

**Real-account code is implemented, but a live Firebase/Google configuration was not supplied.** The included setup APK can be installed and opens the welcome/login setup UI; it cannot register/sign in until the project owner completes **FIREBASE_SETUP.md** and rebuilds. It does not fall back to fake accounts. Do not replace your current working installation expecting live Google login to work without this setup.

**New in 2.1:** Teacher/Admin frontend, server-issued QR display contracts and Light/Dark/System buttons. Management callables are pending Codex implementation; see CODEX_BACKEND_PROMPT.md and docs/BACKEND_CONTRACT.md.

## Added features

- Per-account personal subjects: choose day, start/end time, teacher and room. Add, edit and remove meetings, review and explicitly confirm saves. Conflicting times are rejected.
- Insert a timetable photo; on-device Tesseract OCR reads it with real processing progress, cancellation, success/error state and editable suggestions. Nothing is saved automatically. Check all recognized subjects/days/times before confirmation.
- Firebase email/password authentication, email verification, real password reset/change and Google login integration (native Android Google plugin plus web popup flow).
- Password show/hide controls and advisory strength indicator on every password field, including confirmation/current-password fields.
- Logout confirmation modal with Cancel and Yes, log out.
- Counting attendance percentages/stat cards, animated weekly bars, and respect for reduced-motion preferences.
- Profile photo upload with validation, local resizing and account-scoped cloud persistence. Profile avatars update in Dashboard.
- No canned students, hardcoded credentials, static shared timetable, fake attendance or demo Google buttons.
- Server-verified QR attendance with owner-isolated Firestore records and a trusted callable function; server enrollment/session setup is required.
- Existing history/search/filter/CSV, notification read states, navigation, themes, camera permission/cleanup and Android packaging remain.

## Prerequisites

Node 22.12+ or Node 24; npm; JDK 21; Android Studio with SDK 36, Build Tools 36.0.0 and Platform Tools. Use the included Gradle 8.14.3 wrapper (AGP 8.13.0). The project folder inside the ZIP is still **AbsenSiswa**.

## Commands (Windows PowerShell)

```powershell
cd .\AbsenSiswa
npm ci
```

Configure `.env.local`, Firebase providers/rules and native Google as described in FIREBASE_SETUP.md. Then:

```powershell
npm run build
npx cap sync android
npx cap open android
```

In Android Studio, wait for Gradle Sync and select **Build > Build Bundle(s) / APK(s) > Build APK(s)** (menu label can vary by Studio version). Or:

```powershell
cd android
.\gradlew.bat assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`.

On macOS/Linux use `./gradlew assembleDebug`. For browser development run `npm run dev`. The Android platform already exists; do not run `cap add android` again. Rebuild and sync after web/config changes. Gradle/npm may download dependencies on first use.

## Backend configuration

Follow **FIREBASE_SETUP.md**. It covers Firebase Web values, Email/Password and Google providers, Firestore rules, Android google-services.json and SHA fingerprints, callable deployment and school-owned session/enrollment setup. No cloud resources or real accounts were created/deployed here. Never add a service-account key or a signing key to the client/project ZIP.

## Photo-to-schedule limitations

The app bundles the OCR worker, WASM engine and English text model; there is no paid OCR API or image upload to a third-party recognizer. Photos are processed on the device and discarded when you leave the importer. Only confirmed schedule fields are saved to your Firebase account.

Best-supported text:

```text
Monday 09:00 - 10:30 Web Development
Tuesday Thursday 1:00 PM - 2:30 PM Database Systems
```

English/Tagalog/Indonesian day names can be mapped when recognized. Table grids, column-only layouts, handwritten text, M/W/F abbreviations, blurry/cropped images and ambiguous AM/PM may require editing the extracted text or manual entry. The parser does not invent missing subjects, days or time ranges. For AM/PM, supply it on both ends of a range. Overnight classes should be split across days. The English model is not a guarantee of handwriting/non-Latin OCR support.

Uploads accept JPG/PNG/WebP under 10 MB and 40 megapixels. Schedule images are scaled locally for OCR. Profile photos are resized to at most 256px and JPEG compressed, stripping original image metadata. The small avatar is stored in the owner's private Firestore profile (not a public image bucket).

## Authentication and data limitations

- Internet and the configured Firebase service are required for live accounts and cloud saves. This is not an offline password database.
- No v1 demo account is migrated into a real identity. Previous LocalStorage data is ignored, not silently deleted or uploaded. Keep/export it separately if needed.
- Firebase Auth handles passwords; only profile/subject/setting/attendance data is stored in Firestore.
- Student IDs and personal timetables are self-reported, not school enrollment. Only trusted session/enrollment records allow QR attendance.
- QR tokens can be shared while a session is open. This app does not claim anti-proxy/location verification.
- Absent records must be supplied by a trusted school process. Counts include only actual recorded sessions; an empty account starts at 0, not a fake 85%.
- Notifications are in-app records, not OS push notifications. Native Google OAuth, actual phone camera, system insets and share-sheet behavior still require device testing with your configuration.
- This source is not a completed institutional security/privacy audit; review operational controls before wider real-student deployment.

## Tests and evidence

```powershell
npm test
npm --prefix functions ci
npm --prefix functions run check
```

See **verification-v2/BUILD_REPORT.md** for the actual build, OCR, emulator and test results, including what was not tested. Historical v1 evidence remains under verification/; do not mistake its demo tests/screenshots for v2 live-account evidence. PROJECT_TREE.txt contains the portable source tree.

## Version 2.1 — Teacher/Admin frontend and explicit theme buttons

Student screens are preserved. Settings now has Light (Dark OFF), Dark (Dark ON), and System buttons. Authorized verified teacher/admin accounts see a School workspace in the sidebar. It supports creating classes, enrollment review/removal, attendance session times, server-issued QR display/rotation and session closure. Account access comes from Firebase ID-token custom claims, not an editable profile or registration choice. Settings has a refresh-access button after trusted provisioning.

**Management backend is pending Codex implementation.** These new screens call the exact Firebase callable contracts in docs/BACKEND_CONTRACT.md. They do not fabricate a successful save or generate a local attendance token if services are absent. Existing reference attendance verification remains under functions/. No additional management backend has been deployed. Give Codex CODEX_BACKEND_PROMPT.md with this repository open.

This setup APK is still unconfigured until your real Firebase project is connected and rebuilt. It contains no demo login or self-service teacher/admin access. Do not replace an existing working installation expecting Google login to activate without configuration. Production Google login and physical-device camera tests remain owner setup/testing tasks.

### Windows terminal (inside the extracted AbsenSiswa folder)

```powershell
npm ci
npm test
npm run build
npx cap sync android
npx cap open android
# Or build directly if JDK21 and Android SDK are configured:
cd android
.\gradlew.bat assembleDebug
```

Open android/ in Android Studio, wait for Gradle Sync, then Build > Build Bundle(s) / APK(s) > Build APK(s) (menu label can vary by version). Debug output: android/app/build/outputs/apk/debug/app-debug.apk. Install only on an authorized test phone; debug APK is not a production-signed store release. Rebuild after Firebase environment/native configuration changes.

### Version 2.1 verification and remaining warnings
Clean npm ci, 15 JavaScript unit tests, Vite production build, Capacitor Android sync, Gradle assembleDebug/lintDebug/testDebugUnitTest passed in the supplied build environment. Android lint reports 15 warnings and zero errors; the existing native unit test result is 1 pass. Local Auth/Firestore emulator checks covered theme persistence and trusted roles; new management callable workflows used explicitly labeled HTTP contract fixtures, NOT a finished backend. Production setup UI/protected redirect checks passed. No live Google OAuth or physical Android camera test was performed for this release.

Production npm dependency audit: zero reported vulnerabilities at verification time. Full npm audit: 3 moderate dev-toolchain advisories (@capacitor/cli / xcode / uuid); a force downgrade was not applied. Vite reports a large-bundle warning, not a build failure. See verification-v2.1/ for logs and the current status report; earlier verification folders document historical versions only.
