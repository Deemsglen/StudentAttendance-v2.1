import { backendReady, usingEmulators } from "../services/firebase";
export default function BackendNotice() {
  return !backendReady ? (
    <div className="notice" role="status">
      <strong>Account setup required</strong>
      <p>
        This build is not connected to an account service yet. The project owner
        must complete FIREBASE_SETUP.md and rebuild. Login and Google sign-in
        cannot work until then. No demo accounts are enabled.
      </p>
    </div>
  ) : usingEmulators ? (
    <p className="notice">
      Local testing environment — not a live account service.
    </p>
  ) : null;
}
