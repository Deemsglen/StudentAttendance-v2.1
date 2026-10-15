import { BookOpen } from "lucide-react";
export default function AttendanceCard({ record }) {
  return (
    <article className="attendance-card">
      <span className="subject-icon">
        <BookOpen size={21} />
      </span>
      <div>
        <h3>{record.subject}</h3>
        <p>
          {new Date(record.date + "T12:00:00").toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}{" "}
          · {record.time}
        </p>
        <small>{record.source}</small>
      </div>
      <span className={`badge ${record.status.toLowerCase()}`}>
        {record.status}
      </span>
    </article>
  );
}
