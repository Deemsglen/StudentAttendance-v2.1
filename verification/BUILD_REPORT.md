# Actual build and verification report

## Delivered project

- Directory: `/data/AbsenSiswa`
- Android application ID: `com.deemsglen.absensiswa`
- UI: React / JSX, Vite, Tailwind CSS. Java Capacitor native host; no Jetpack Compose interface.
- Capacitor Android platform was added once, generated successfully and synced after each final production build.
- No reference screenshot was accessible; layout follows the user's written design requirements.

## Executed checks

| Check | Actual result |
| --- | --- |
| npm dependency installation | Completed; lockfile included |
| Vite production build | PASS; actual output in `react-build-final.log` |
| Node attendance regression tests | 6 passed, 0 failed; `unit-tests-final.log` |
| Capacitor add/sync | PASS; generated Android Studio project and bundled assets present |
| Gradle `assembleDebug lintDebug` | BUILD SUCCESSFUL; `android-build-final.log` |
| APK signature verification | Verified with Android SDK apksigner; debug signature |
| APK package inspection | Correct ID, Student Attendance label, minimum SDK 24, target SDK 36, camera permission |
| Browser app flows | PASS; `ui-test-results.json` |
| Additional account/CSV/narrow-width tests | PASS; `extra-test-results.json` |
| Optical QR decoding | PASS using synthetic QR camera video in headless Chromium, NOT a physical device |
| Camera resource cleanup | Tracks ended after scan and after leaving scanner; `camera-test-results.json` |
| Permission-denied UX | PASS with simulated `NotAllowedError` in Chromium |
| Android host unit tests / instrumentation APK compilation | PASS; `android-test-compile.log`. Instrumentation tests were NOT executed on a device. |
| Physical Android/device/emulator tests | NOT RUN; `adb devices` showed no attached device |
| Android Studio GUI / Gradle Sync UI | NOT RUN; native project compiled using Gradle wrapper instead |

## Build toolchain and corrective work

The first Gradle attempt with the preinstalled Java 25 failed with `Unsupported class file major version 69`. Installed Amazon Corretto JDK 21 and Android command-line SDK tools, Platform 36, Build Tools 36.0.0 and Platform Tools. Rebuilt successfully with JDK 21 and the generated Gradle 8.14.3 wrapper / AGP 8.13.0. The exact npm versions are listed in README and package-lock.json.

The camera test exposed teardown problems when leaving immediately after camera startup. The implementation now holds independent stream-track references, uses layout-phase unmount cleanup, and handles camera startup cancellation. Repeated tests verified ended tracks after scan completion and route exit. A library-level interrupted media `play()` console message can still occur on rapid synthetic-camera exit; it is included in the test JSON and documented in README. It does not leave a live camera track in the tested scenario.

## Browser coverage

Local sandbox Chromium; no user browser/authentication involved. Mobile viewports 390×844 and 320×740; desktop 1280×900. Flow checks covered:

- Failed and successful login, registration validation/account creation, logout and route protection.
- Reloaded session persistence, per-account empty records, profile editing and local password change.
- Manual QR success, duplicate rejection, malformed/expired/unknown/non-demo QR unit checks.
- History search/filter empty state and a real CSV download with inspected header contents.
- All requested screens, menu open/close, theme changes, read-notification persistence and empty schedule.
- Horizontal overflow checks across protected routes at 390px and 320px.
- Synthetic optical QR decoding, camera shutdown and denied-permission fallback.

Screenshots of all requested screens plus key error/empty/expanded states were captured and visually inspected. Selected captures are included in `screenshots/`. Full-page captures show fixed navigation at the viewport boundary inside a taller image; the app uses a normal fixed bottom navigation with scrollable content and bottom padding.

## Non-blocking findings and limitations

- Android lint passed with no errors. Warnings remain for generated resources, dependency update suggestions and optional launcher/splash configurations. Full lint XML is included as `android-lint.xml`; no production readiness claim is made.
- npm audit reports three moderate **development/tooling** findings through Capacitor CLI's xcode/uuid dependency chain. Production dependencies audit clean. `npm-audit.json` preserves the exact report. No unsafe forced dependency upgrade was applied.
- All authentication, attendance QR validation and student data are local-demo behavior, not secure school infrastructure. Passwords are unencrypted; use only fictional credentials.
- Real Android camera focus, runtime-permission UX, OEM-specific system insets/back gestures, native CSV sharing and installation remain device acceptance tasks. See README checklist.

## Outputs

- Native output: `android/app/build/outputs/apk/debug/app-debug.apk`
- Distribution copy: `artifacts/StudentAttendance-debug.apk`
- Checksum: `apk-sha256.txt`
- APK signature: `apk-signature.txt`
- App identity/permissions: `apk-badging.txt`

The debug APK is installable and debug-signed. The source archive omits node_modules, Gradle/build caches and local.properties to remain portable. Run `npm ci`, build/sync, then open `android/` in Android Studio. The included source includes Gradle wrapper scripts/JAR and native project configuration, not merely web files.
