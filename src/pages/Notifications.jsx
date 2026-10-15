import { Bell, CheckCheck, CalendarDays, Megaphone } from "lucide-react";
import { useAttendance } from "../context/AttendanceContext";
import EmptyState from "../components/EmptyState";
export default function Notifications() {
  const { notifications, markRead } = useAttendance();
  return (
    <>
      <div className="page-title">
        <span className="eyebrow">STAY IN THE LOOP</span>
        <h1>Notifications</h1>
        <p className="muted">
          Your attendance confirmations and account updates.
        </p>
      </div>
      <button
        className="text-button"
        onClick={() => markRead("all").catch((e) => alert(e.message))}
        disabled={notifications.every((n) => n.read)}
      >
        <CheckCheck size={19} />
        Mark all as read
      </button>
      {notifications.length ? (
        notifications.map((n) => {
          const Icon =
            n.kind === "confirmation"
              ? CheckCheck
              : n.kind === "reminder"
                ? CalendarDays
                : Megaphone;
          return (
            <article
              key={n.id}
              className={`notification-card ${n.read ? "read" : ""}`}
            >
              <span className="subject-icon">
                <Icon size={22} />
              </span>
              <div>
                <h2>{n.title}</h2>
                <p>{n.body}</p>
                {n.read ? (
                  <small className="muted">Read</small>
                ) : (
                  <button
                    className="text-button"
                    onClick={() =>
                      markRead(n.id).catch((e) => alert(e.message))
                    }
                  >
                    Mark as read
                  </button>
                )}
              </div>
              {!n.read && (
                <span className="unread-indicator" aria-label="Unread" />
              )}
            </article>
          );
        })
      ) : (
        <EmptyState />
      )}
    </>
  );
}
