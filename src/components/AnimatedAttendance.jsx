import { useAnimatedNumber } from "../hooks/useAnimatedNumber";
export function AttendanceRing({ percentage }) {
  const n = useAnimatedNumber(percentage, 1300);
  return (
    <div
      className="progress-ring"
      style={{ "--progress": `${n}%` }}
      aria-label={`${percentage}% attendance`}
    >
      <div>
        <strong aria-hidden="true">{Math.round(n)}%</strong>
        <small>attended</small>
      </div>
    </div>
  );
}
export function WeeklyBar({ percentage, index }) {
  const n = useAnimatedNumber(percentage, 1000, index * 80);
  return (
    <div className="bar-track">
      <div style={{ height: `${n}%` }} />
    </div>
  );
}
