import { Link } from "react-router-dom";
import { ArrowRight, ScanLine, ShieldCheck } from "lucide-react";
export default function Welcome() {
  return (
    <div className="welcome">
      <div className="brand">
        <img src="/logo.svg" alt="" />
        Student Attendance
      </div>
      <span className="eyebrow">YOUR CAMPUS COMPANION</span>
      <img
        className="students"
        src="/students.jpg"
        alt="Two students checking their campus app"
      />
      <div className="welcome-copy">
        <span className="pill">Less paperwork. More possibility.</span>
        <h1>
          Show up.
          <br />
          <em>Make it count.</em>
        </h1>
        <p>
          Your classes, attendance and campus updates.
          <br />
          All together, right in your pocket.
        </p>
      </div>
      <div className="welcome-points">
        <span>
          <ScanLine size={19} /> Check in with a scan
        </span>
        <span>
          <ShieldCheck size={19} /> Stay on track
        </span>
      </div>
      <Link to="/login" className="button full">
        Get Started <ArrowRight size={20} />
      </Link>
      <p className="muted center">Made for students. Built for every day.</p>
      <small className="demo-label">
        Your subjects. Your schedule. Your progress.
      </small>
    </div>
  );
}
