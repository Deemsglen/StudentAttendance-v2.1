import { useState } from "react";
import { Download, Search } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { useAttendance } from "../context/AttendanceContext";
import { toCSV } from "../utils/attendance";
import AttendanceCard from "../components/AttendanceCard";
import EmptyState from "../components/EmptyState";
export default function AttendanceHistory() {
  const { records } = useAttendance(),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const filtered = records
    .filter(
      (r) =>
        (filter === "All" || r.status === filter) &&
        `${r.subject} ${r.date}`.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  async function exportCSV() {
    setBusy(true);
    try {
      const csv = toCSV(filtered),
        filename = `StudentAttendance-${Date.now()}.csv`;
      if (Capacitor.isNativePlatform()) {
        const file = await Filesystem.writeFile({
          path: filename,
          data: btoa(unescape(encodeURIComponent(csv))),
          directory: Directory.Cache,
        });
        await Share.share({
          title: "Attendance records",
          url: file.uri,
          dialogTitle: "Export attendance CSV",
        });
        setMessage("CSV prepared for sharing. Save it using your chosen app.");
      } else {
        const url = URL.createObjectURL(
          new Blob([csv], { type: "text/csv;charset=utf-8" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage("CSV download requested.");
      }
    } catch (e) {
      setMessage(`Export could not complete: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-title">
        <span className="eyebrow">YOUR JOURNEY</span>
        <h1>Attendance history</h1>
        <p className="muted">Every check-in, in one place.</p>
      </div>
      <div className="search-input">
        <Search size={20} />
        <input
          aria-label="Search subject or date"
          placeholder="Search subject or YYYY-MM-DD"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="filters" aria-label="Filter attendance">
        {["All", "Present", "Late", "Absent"].map((f) => (
          <button
            key={f}
            aria-pressed={f === filter}
            className={f === filter ? "selected" : ""}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="section-heading">
        <p>{filtered.length} records</p>
        <button
          className="text-button"
          disabled={busy || !filtered.length}
          onClick={exportCSV}
        >
          <Download size={18} />
          {busy ? "Exporting…" : "Export CSV"}
        </button>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {filtered.length ? (
        filtered.map((r) => <AttendanceCard key={r.id} record={r} />)
      ) : (
        <EmptyState
          title="No matching records"
          message="Try a different search or filter, or scan a school-issued attendance QR."
        />
      )}
    </>
  );
}
