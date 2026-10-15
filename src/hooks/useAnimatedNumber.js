import { useEffect, useState } from "react";
export function useAnimatedNumber(target, duration = 1100, delay = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame, timer;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      setValue(target);
      return;
    }
    setValue(0);
    timer = setTimeout(() => {
      let start;
      const tick = (now) => {
        if (start === undefined) start = now;
        const p = Math.min(1, (now - start) / duration);
        setValue(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [target, duration, delay]);
  return value;
}
