import { Link } from "react-router-dom";
import { Menu, Bell } from "lucide-react";
import { useAttendance } from "../context/AttendanceContext";
export default function AppHeader({ onMenu }) {
  const { notifications } = useAttendance();
  const unread = notifications.filter((n) => !n.read).length;
  return (
    <header className="app-header">
      <button className="icon-button" onClick={onMenu} aria-label="Open menu">
        <Menu />
      </button>
      <Link to="/dashboard" className="brand">
        <img src="/logo.svg" alt="" />
        Student Attendance
      </Link>
      <Link
        to="/notifications"
        className="icon-button notification"
        aria-label={`Notifications, ${unread} unread`}
      >
        <Bell />
        {unread > 0 && <span className="dot" />}
      </Link>
    </header>
  );
}
