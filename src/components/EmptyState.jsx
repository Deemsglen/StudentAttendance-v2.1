import { FolderOpen } from "lucide-react";
export default function EmptyState({
  title = "Nothing here yet",
  message = "Your records will appear here.",
}) {
  return (
    <div className="empty">
      <FolderOpen size={36} />
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}
