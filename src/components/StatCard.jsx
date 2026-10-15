import AnimatedStat from "./AnimatedStat";
export default function StatCard({ label, value, icon: Icon, tone }) {
  return (
    <div className={`stat-card ${tone}`}>
      <span className="stat-icon">
        <Icon size={21} />
      </span>
      <strong>
        <AnimatedStat value={value} />
      </strong>
      <span>{label}</span>
    </div>
  );
}
