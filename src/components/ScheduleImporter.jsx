import { useEffect, useRef, useState } from "react";
import { ImagePlus, CheckCircle2 } from "lucide-react";
import { createWorker } from "tesseract.js";
import { parseScheduleText } from "../utils/schedule";
export default function ScheduleImporter({ onDraft }) {
  const statusRef = useRef(null);
  const input = useRef(),
    worker = useRef(null),
    job = useRef(0),
    urlRef = useRef("");
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [stage, setStage] = useState(""),
    [text, setText] = useState(""),
    [preview, setPreview] = useState(""),
    [error, setError] = useState(""),
    [complete, setComplete] = useState(false);
  useEffect(
    () => () => {
      job.current++;
      worker.current?.terminate();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );
  useEffect(() => {
    if (busy) statusRef.current?.scrollIntoView({ block: "center" });
  }, [busy]);
  async function cancel() {
    job.current++;
    await worker.current?.terminate();
    worker.current = null;
    setBusy(false);
    setStage("Import cancelled. No schedule was saved.");
  }
  function extract(value) {
    const parsed = parseScheduleText(value);
    onDraft(parsed.rows);
    if (parsed.unresolved.length)
      setError(
        `${parsed.unresolved.length} line(s) could not be assigned reliably. Check the extracted text and add missing subjects manually. Nothing has been saved.`,
      );
    else if (!parsed.rows.length)
      setError(
        "No complete day + subject + time range was found. Edit the text or add subjects manually.",
      );
    else setError("");
    return parsed;
  }
  async function scan(file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use a clear JPG, PNG or WebP timetable photo.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Use a timetable image smaller than 10 MB.");
      return;
    }
    const current = ++job.current;
    setBusy(true);
    setComplete(false);
    setError("");
    setText("");
    setProgress(0);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(file);
    setPreview(urlRef.current);
    let localWorker;
    try {
      setStage("Preparing photo…");
      const bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 40000000) {
        bitmap.close();
        throw new Error(
          "Image resolution is too high. Resize the image first.",
        );
      }
      const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      if (current !== job.current) return;
      const base = new URL("ocr/", document.baseURI).href;
      localWorker = await createWorker("eng", 1, {
        workerPath: `${base}worker.min.js`,
        corePath: base,
        langPath: base,
        workerBlobURL: false,
        gzip: false,
        logger: (m) => {
          if (current === job.current) {
            setStage(
              m.status === "recognizing text"
                ? "Reading subjects, days and times…"
                : "Loading on-device text reader…",
            );
            setProgress((p) =>
              Math.max(
                p,
                Math.round(
                  (m.status === "recognizing text"
                    ? 0.25 + m.progress * 0.65
                    : m.progress * 0.2) * 100,
                ),
              ),
            );
          }
        },
      });
      if (current !== job.current) {
        await localWorker.terminate();
        return;
      }
      worker.current = localWorker;
      const result = await localWorker.recognize(canvas);
      if (current !== job.current) return;
      setProgress(95);
      setStage("Preparing your schedule for review…");
      setText(result.data.text);
      const parsed = extract(result.data.text);
      setProgress(100);
      setStage(
        parsed.rows.length
          ? `${parsed.rows.length} class meeting(s) ready for review. Confirm before saving.`
          : "Text read successfully. Review the text to create class meetings.",
      );
      setComplete(true);
    } catch (e) {
      if (current === job.current)
        setError(
          `Could not finish reading this image: ${e.message}. Try a sharper photo or add subjects manually.`,
        );
    } finally {
      if (localWorker) await localWorker.terminate().catch(() => {});
      if (worker.current === localWorker) worker.current = null;
      if (current === job.current) setBusy(false);
    }
  }
  return (
    <section className="panel schedule-import">
      <div className="section-heading">
        <h2>Set up from a photo</h2>
        <ImagePlus size={23} />
      </div>
      <p className="muted">
        Upload your timetable. The app reads it on this device and suggests
        subjects, days and times. Always review before confirming.
      </p>
      <input
        hidden
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Import schedule photo"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) scan(file);
        }}
      />
      <button
        className="button secondary full"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        <ImagePlus size={19} />
        {preview ? "Choose another photo" : "Insert schedule photo"}
      </button>
      {preview && (
        <img
          src={preview}
          className="schedule-preview"
          alt="Timetable selected for text recognition"
        />
      )}
      {busy && (
        <div ref={statusRef} className="ocr-status" role="status">
          <div className="section-heading">
            <span className="spinner" />
            <strong>{progress}%</strong>
          </div>
          <progress
            value={progress}
            max="100"
            aria-label="Schedule photo processing"
          />
          <p>{stage}</p>
          <button className="text-button" onClick={cancel}>
            Cancel processing
          </button>
        </div>
      )}
      {!busy && stage && (
        <p className={complete ? "success" : "notice"} role="status">
          {complete && <CheckCircle2 size={19} />} {stage}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {text && (
        <details>
          <summary>Review extracted text / fix recognition</summary>
          <p className="muted">
            Best-supported format: Monday 09:00 - 10:30 Web Development. For
            AM/PM, include AM or PM on both times. Table columns, abbreviations
            and blurry photos may need manual corrections.
          </p>
          <textarea
            aria-label="Extracted schedule text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
          />
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => extract(text)}
          >
            Re-read this text
          </button>
        </details>
      )}
      <p className="muted">
        Photo stays on your device. Only the subjects you confirm are uploaded
        to your account.
      </p>
    </section>
  );
}
