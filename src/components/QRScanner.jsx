import { useLayoutEffect, useRef, useState } from "react";
import { Camera, Square } from "lucide-react";
export default function QRScanner({ onResult }) {
  const scanner = useRef(null),
    tracks = useRef([]),
    mounted = useRef(true),
    starting = useRef(false),
    cancelled = useRef(false),
    callback = useRef(onResult);
  callback.current = onResult;
  const [state, setState] = useState("idle"),
    [error, setError] = useState("");
  async function release() {
    if (starting.current) {
      cancelled.current = true;
      return;
    }
    // Hold track references independently of the library DOM for reliable unmount cleanup.
    tracks.current.forEach((track) => track.stop());
    tracks.current = [];
    const current = scanner.current;
    if (current) {
      try {
        if (current.isScanning) await current.stop();
        current.clear();
      } catch {}
      if (scanner.current === current) scanner.current = null;
    }
  }
  useLayoutEffect(() => {
    mounted.current = true;
    const pause = () => {
      if (document.hidden)
        release().then(() => {
          if (mounted.current) setState("idle");
        });
    };
    document.addEventListener("visibilitychange", pause);
    return () => {
      mounted.current = false;
      document.removeEventListener("visibilitychange", pause);
      void release();
    };
  }, []);
  async function start() {
    if (starting.current || scanner.current) return;
    starting.current = true;
    cancelled.current = false;
    setError("");
    setState("starting");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!mounted.current) return;
      const instance = new Html5Qrcode("qr-reader");
      scanner.current = instance;
      let found = false;
      await instance.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        (raw) => {
          if (found) return;
          found = true;
          setTimeout(async () => {
            await release();
            if (mounted.current) {
              setState("idle");
              callback.current(raw);
            }
          }, 0);
        },
        () => {},
      );
      tracks.current =
        document.querySelector("#qr-reader video")?.srcObject?.getTracks() ||
        [];
      starting.current = false;
      if (!mounted.current || document.hidden || cancelled.current) {
        await release();
        if (mounted.current) setState("idle");
        return;
      }
      setState("scanning");
    } catch (e) {
      starting.current = false;
      await release();
      if (mounted.current) {
        setError(
          "Camera unavailable or permission denied. Allow camera access in Android app settings, or ask your instructor for an authorized attendance alternative.",
        );
        setState("idle");
      }
    } finally {
      starting.current = false;
    }
  }
  return (
    <>
      <div className="camera-frame">
        <div id="qr-reader" />
        {state === "idle" && (
          <div className="camera-placeholder">
            <Camera size={44} />
            <p>Point your camera at the class QR</p>
            <small>Your camera stays off until you start.</small>
          </div>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button full"
        disabled={state === "starting"}
        onClick={
          state === "scanning"
            ? async () => {
                await release();
                setState("idle");
              }
            : start
        }
      >
        {state === "scanning" ? <Square size={18} /> : <Camera size={19} />}{" "}
        {state === "starting"
          ? "Requesting camera…"
          : state === "scanning"
            ? "Stop camera"
            : "Start camera"}
      </button>
      <p className="muted center" role="status">
        {state === "scanning"
          ? "Scanning… hold the QR steady."
          : "Camera is off"}
      </p>
    </>
  );
}
