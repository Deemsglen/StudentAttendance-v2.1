export default function Avatar({ user, large = false }) {
  return (
    <span className={`avatar ${large ? "large" : ""}`}>
      {user.avatar ? (
        <img
          src={user.avatar}
          alt={`${user.name}'s profile`}
          referrerPolicy="no-referrer"
        />
      ) : (
        (user.name || "Student")
          .split(" ")
          .filter(Boolean)
          .map((x) => x[0])
          .slice(0, 2)
          .join("")
      )}
    </span>
  );
}
