# Display-name-only update

The app is now displayed as **Student Attendance** in the Android launcher/activity title, React header, welcome screen, About screen, sidebar, login image alternative text, browser title and branded error/export text.

No application functions were removed or changed. All 26 original React source files remain. Comparison against the pre-rename copies verified that the only changed source lines contain display/branding strings; see rename-source-diff.txt and rename-source-check.json.

Unchanged intentionally:
- Android application ID: com.deemsglen.absensiswa
- npm package name and project folder
- LocalStorage namespace and account data keys
- Demo email/password and all account logic
- QR payload's internal app marker and scanner/duplicate validation logic
- Icons, illustrations, CSS, routes and all attendance features

Preserving the app ID and the original signing certificate allows this APK to replace the earlier APK as an update. Do not uninstall the old app if you want to retain its local data. A real existing-device data migration was not tested.

Verified:
- React production build passed.
- All six logic tests passed.
- Gradle assembleDebug lintDebug: BUILD SUCCESSFUL.
- APK signature verified; signing certificate matches the earlier APK.
- APK application-label is Student Attendance.
- Browser login, manual demo QR and duplicate prevention passed.
- New name fits at 390px and wraps normally at 320px, with no horizontal overflow.

Output: artifacts/StudentAttendance-debug.apk
Full source archive: StudentAttendance-project.zip (contains the original AbsenSiswa project directory).

The earlier BUILD_REPORT describes the original full application implementation. Existing older screenshots/logs are retained as historical verification; files prefixed rename- or studentattendance- record this rename.
