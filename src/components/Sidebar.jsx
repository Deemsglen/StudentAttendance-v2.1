import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
export default function Sidebar({ open, onClose }) {
  const ref = useRef();
  const { canManageClasses, role } = useAuth();
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sidebar"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="section-heading">
        <h2>Explore</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X />
        </button>
      </div>
      <nav>
        {[
          ["/dashboard", "Dashboard"],
          ["/history", "Attendance history"],
          ["/scan", "Scan attendance"],
          ["/schedule", "Weekly schedule"],
          ["/notifications", "Notifications"],
          ["/profile", "My profile"],
          ["/settings", "Settings"],
        ].map(([url, label]) => (
          <Link key={url} to={url} onClick={onClose}>
            {label}
          </Link>
        ))}
        {canManageClasses && (
          <Link to="/teacher" onClick={onClose}>
            {role === "admin" ? "Admin" : "Teacher"} workspace
          </Link>
        )}
      </nav>
      <p className="muted">Student Attendance 2.1</p>
    </dialog>
  );
}
