export default function LoadingState({ message = "Loading…" }) {
  return (
    <p className="notice" role="status">
      {message}
    </p>
  );
}
