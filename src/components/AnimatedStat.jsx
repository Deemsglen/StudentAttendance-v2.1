import { useAnimatedNumber } from "../hooks/useAnimatedNumber";
export default function AnimatedStat({ value, suffix = "" }) {
  const number = useAnimatedNumber(value);
  return (
    <span aria-label={`${value}${suffix}`}>
      <span aria-hidden="true">
        {Math.round(number)}
        {suffix}
      </span>
    </span>
  );
}
