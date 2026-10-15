import type { CapacitorConfig } from "@capacitor/cli";
import { existsSync } from "node:fs";
// Do not load the native Firebase SDK without a real google-services.json.
const hasNativeFirebase = existsSync("android/app/google-services.json");
const config: CapacitorConfig = {
  appId: "com.deemsglen.absensiswa",
  appName: "Student Attendance",
  webDir: "dist",
  android: { backgroundColor: "#f5f8ff" },
  includePlugins: [
    "@capacitor/app",
    "@capacitor/status-bar",
    "@capacitor/filesystem",
    "@capacitor/share",
    ...(hasNativeFirebase ? ["@capacitor-firebase/authentication"] : []),
  ],
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: "LIGHT",
      backgroundColor: "#2456db",
    },
    FirebaseAuthentication: { skipNativeAuth: true, providers: ["google.com"] },
  },
};
export default config;
