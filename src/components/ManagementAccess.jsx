import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import LoadingState from "./LoadingState";
export default function ManagementAccess({ children }) {
  const { roleLoading, canManageClasses, user } = useAuth();
  if (roleLoading) return <LoadingState message="Checking school access…" />;
  if (!canManageClasses || !user.emailVerified)
    return (
      <section className="panel">
        <ShieldCheck size={32} />
        <h1>School access required</h1>
        <p className="muted">
          This workspace is for verified teachers and administrators. Your
          school must assign access securely. A personal subject does not grant
          teacher access.
        </p>
        <Link className="button secondary" to="/settings">
          Account access settings
        </Link>
      </section>
    );
  return children;
}
