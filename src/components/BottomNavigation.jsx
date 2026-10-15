import { NavLink } from "react-router-dom";
import { House, CalendarDays, QrCode, History, UserRound } from "lucide-react";
export default function BottomNavigation() {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {[
        ["/dashboard", House, "Home"],
        ["/history", History, "History"],
        ["/scan", QrCode, "Scan QR"],
        ["/schedule", CalendarDays, "Schedule"],
        ["/profile", UserRound, "Profile"],
      ].map(([to, Icon, label]) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `${isActive ? "active " : ""}${to === "/scan" ? "scan-link" : ""}`
          }
        >
          <span>
            <Icon size={22} />
          </span>
          <small>{label}</small>
        </NavLink>
      ))}
    </nav>
  );
}
