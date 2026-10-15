import { Link } from "react-router-dom";
import {
  CheckCheck,
  Clock3,
  UserX,
  QrCode,
  CalendarDays,
  ArrowUpRight,
  Bell,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useAttendance } from "../context/AttendanceContext";
import { summarize } from "../utils/attendance";
import { localDate } from "../data/date";
import Avatar from "../components/Avatar";
import { AttendanceRing, WeeklyBar } from "../components/AnimatedAttendance";
import StatCard from "../components/StatCard";
import AttendanceCard from "../components/AttendanceCard";
import EmptyState from "../components/EmptyState";
export default function Dashboard() {
  const { user } = useAuth(),
    { records, notifications } = useAttendance(),
    stats = summarize(records);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const rows = records.filter((r) => r.date === localDate(d));
    return {
      label: d.toLocaleDateString("en", { weekday: "short" }),
      ...summarize(rows),
    };
  });
  return (
    <>
      <section className="greeting">
        <div>
          <p className="muted">Let's make today count 👋</p>
          <h1>Hi, {user.name.split(" ")[0]}!</h1>
          <p>
            {user.course || "Set your course in Profile"} · Year {user.year}
          </p>
        </div>
        <Link className="avatar-link" to="/profile" aria-label="Open profile">
          <Avatar user={user} />
        </Link>
      </section>
      <section className="overview">
        <span className="eyebrow">YOUR ATTENDANCE</span>
        <div className="overview-line">
          <div>
            <h2>
              Small steps.
              <br />
              Strong semester.
            </h2>
            <p>Every class is a step forward.</p>
          </div>
          <AttendanceRing percentage={stats.percentage} />
        </div>
        <div className="overview-footer">
          <CheckCheck size={17} />
          {stats.Present + stats.Late} of {stats.total} sessions attended ·
          Includes late
        </div>
      </section>
      <div className="stats-grid">
        <StatCard
          label="Present"
          value={stats.Present}
          icon={CheckCheck}
          tone="green"
        />
        <StatCard label="Late" value={stats.Late} icon={Clock3} tone="orange" />
        <StatCard label="Absent" value={stats.Absent} icon={UserX} tone="red" />
      </div>
      <div className="quick-actions">
        <Link to="/scan">
          <span className="quick-icon">
            <QrCode />
          </span>
          <div>
            <strong>Scan attendance</strong>
            <small>A quick check-in</small>
          </div>
          <ArrowUpRight size={20} />
        </Link>
        <Link to="/schedule">
          <span className="quick-icon pale">
            <CalendarDays />
          </span>
          <div>
            <strong>My schedule</strong>
            <small>Plan your week</small>
          </div>
        </Link>
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>Your week in focus</h2>
          <span className="muted">Last 7 days</span>
        </div>
        <div
          className="chart"
          role="img"
          aria-label={days
            .map((d) => `${d.label}: ${d.percentage}% attendance`)
            .join(", ")}
        >
          {days.map((d, i) => (
            <div className="chart-column" key={i}>
              <small>{d.total ? `${d.percentage}%` : "—"}</small>
              <WeeklyBar percentage={d.percentage} index={i} />
              <span>{d.label}</span>
            </div>
          ))}
        </div>
        <p className="muted chart-caption">
          Attended sessions ÷ recorded sessions. No record = —.
        </p>
      </section>
      <section>
        <div className="section-heading">
          <h2>Recent attendance</h2>
          <Link to="/history">View all →</Link>
        </div>
        {records.length ? (
          records
            .slice(0, 3)
            .map((r) => <AttendanceCard key={r.id} record={r} />)
        ) : (
          <EmptyState message="Your school-verified attendance will appear here." />
        )}
      </section>
      <section className="notification-preview">
        <Bell size={22} />
        <div>
          <h3>{notifications[0]?.title || "All caught up"}</h3>
          <p>{notifications[0]?.body || "No new campus updates."}</p>
          <Link to="/notifications">See notifications →</Link>
        </div>
      </section>
      <p className="demo-label">
        Only server-verified attendance records are counted.
      </p>
    </>
  );
}
