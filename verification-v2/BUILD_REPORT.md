# Student Attendance 2.0 — actual verification

## Live service status (important)

**No live Firebase project, OAuth client settings, google-services.json or school roster/session data was provided. No cloud project was created or deployed.** The distributed APK is a setup build: it opens the app/welcome/authentication UI, explicitly explains the missing configuration, and blocks unconfigured login instead of pretending that real accounts work.

The actual Firebase account and data implementation is in the source and was exercised against isolated local Auth/Firestore/Functions emulators. These are developer tests, NOT real Google OAuth, real student accounts or a deployed school service. No testing account or emulator project ID is embedded into the production APK.

To activate real accounts: complete FIREBASE_SETUP.md, supply your own public Firebase web configuration and Android google-services.json/SHA fingerprints, deploy rules/backend as required, then rebuild. The native Firebase Auth plugin is deliberately excluded from the unconfigured setup APK to avoid initializing a missing Firebase native app; capacitor.config.ts automatically includes it after the real google-services.json is present and cap sync is run. Native Google integration with real project configuration remains untested.

## Implemented changes

- Personal UID-scoped subject/day/time/teacher/room schedule CRUD, explicit save confirmation and overlap validation.
- Actual on-device photo OCR with bundled worker/WASM/English model, real processing stages/progress, cancellation, editable recognized text and editable subject suggestions. No save until explicit confirmation.
- Ambiguous multi-column headings, multiple time ranges in one OCR line, missing days and ambiguous AM/PM are flagged rather than guessed. Review is mandatory.
- Firebase email registration/login, verification request/refresh, reset request, password change with reauthentication and real Google SDK integration paths.
- Password visibility and strength controls across login, registration, current/new/confirmation fields.
- Logout confirmation; a logout redirect race was found in testing and fixed.
- Profile photo validation, local resizing, account-scoped cloud persistence and shared avatar display.
- Animated attendance percentage, stat counts and day bars, with reduced-motion support.
- No canned students/passwords, static shared schedule, demo scan or client-written attendance.
- Firestore rules isolate owners; only the trusted callable function writes attendance. Server checks verified email, school enrollment, valid token, time window and transactional duplicates.

## Actual results

| Check | Result |
| --- | --- |
| React production build | PASS; v2-react-build-final.log |
| Node logic tests | 11 passed, 0 failed; v2-unit-final.log |
| Backend syntax check | PASS; v2-backend-check.log |
| Android build | assembleDebug + lintDebug + app:testDebugUnitTest: BUILD SUCCESSFUL |
| Android app lint | No errors; 15 generated-resource/update/optional-icon warnings |
| Android host unit test | 1 passed, 0 failures (template native host test, not end-to-end device coverage) |
| APK package | com.deemsglen.absensiswa; label Student Attendance; version code 2; min SDK 24; target SDK 36 |
| APK signature | Verified debug signature; apk-signature.txt |
| Bundled assets | 21 final web/OCR files verified byte-for-byte against APK assets, including eng.traineddata |
| Runtime demo data check | No v1 sample password/ID, sample QR images, emulator project/config or animation fixtures in the APK web bundle |
| UI flows | PASS against local emulators; v2-ui-results.json |
| Extra UI flows | PASS; v2-extra-results.json |
| Backend authorization/rules | 11 checks passed; v2-backend-results.json |
| Optical camera-to-server path | PASS with synthetic QR video + local backend; v2-camera-results.json |
| Production setup state | PASS; v2-production-results.json |
| Real Google consent/token issuance | NOT TESTED |
| Real email delivery | NOT TESTED; emulator requests/verification-claim refresh only |
| Physical Android/emulator camera/UI | NOT TESTED; no attached Android device |
| Live backend deployment/institutional security review | NOT PERFORMED |

## Tested feature details

UI tests created a local emulator account, registered/signed in, checked password reveal/strength, refreshed an emulator-verified email, saved a manual subject, imported a real timetable image through the OCR engine, reviewed two correctly extracted day/time/subject rows, confirmed three personal meetings, uploaded/resized a profile photo, confirmed no password field in the profile document, cancelled/confirmed logout and signed in again. Additional checks covered editing a subject, overlapping-time rejection, OCR cancellation without saving, password-reset request, password change with reauthentication, dark-theme persistence and 320px layout.

The counter was observed at an intermediate percentage before reaching its computed 67% value. Chart/stat fixtures existed only in the local test database and are explicitly labelled in the test screenshots; they are not initial data or code in the shipped app.

Backend checks verified enrolled/verified attendance creation, duplicates, wrong tokens, unenrolled users, unverified email, anonymous requests, expired sessions, owner vs cross-account reads, rejected direct client attendance writes, rejected password profile fields and private session secret access. This is a regression test suite, not a guarantee of comprehensive production security.

Optical integration tests decoded a QR from synthetic video, submitted it with a Firebase emulator ID token, created a server attendance record, rejected a duplicate and confirmed ended camera tracks. This is NOT a physical Android camera test.

## Corrective work and build notes

- Android AAPT normalizes `.gz` assets. The first APK asset audit detected that the gzipped OCR model name was changed during packaging. Fixed by bundling raw eng.traineddata and using gzip:false on both web and Android. Actual photo OCR was repeated successfully with the raw model, and the final APK asset audit passed byte-for-byte.
- A compatible same-major @grpc/grpc-js override to ^1.14.6 removed a high-severity transitive advisory from the Firebase Node dependency variant; no forced Firebase/Capacitor downgrade was applied.
- Backend dependencies were updated to firebase-admin 14.5.0 and firebase-functions 7.4.0 and all 11 server/rule checks passed again.
- Main production-dependency audit: zero findings. Main full audit: 3 moderate Capacitor CLI/xcode/uuid development-tool findings. Backend dependency audit: zero findings. Exact JSON reports are included.
- Vite emits a non-blocking large-chunk warning for the Firebase-containing JS bundle. Build succeeds; performance splitting can be improved separately without pretending it is a compile failure.
- Native compilation used JDK 21, SDK 36 / Build Tools 36.0.0, Gradle 8.14.3 and AGP 8.13.0. Functions declare Node 22; the local emulator used the host Node 24 (CLI warned about this mismatch). Actual cloud Node 22 deployment remains untested.
- Visual screenshots at 390px and desktop 1280px were inspected; 320px overflow checks passed across protected routes. Full-page captures place sticky/fixed header/navigation within the taller capture according to scroll position; actual screens are normally scrollable and bottom-padded.

## Output and next blocker

- Native output: android/app/build/outputs/apk/debug/app-debug.apk
- Distribution: artifacts/StudentAttendance-v2-setup.apk
- Checksum and signature: apk-sha256.txt / apk-signature.txt
- Full instructions: README.md and FIREBASE_SETUP.md

Do not replace a currently working installation expecting this unconfigured APK to have live Google login. The precise remaining blocker is the user's Firebase web configuration, Android Google/Firebase configuration, deployed access rules and (for QR attendance) a deployed school verification service and administrator-created session/enrollment data. No credentials or school facts were invented to hide that blocker.
