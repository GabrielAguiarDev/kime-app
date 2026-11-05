import { useEffect, useRef, useState } from 'react';

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * `target` reached over `durationMs`, frame by frame (ease-out); instant when
 * `instant` (e.g. "Reduce motion"). Starts at the first value: nothing moves
 * when the screen opens, only on changes. A new target mid-way continues from
 * the current value. Driven from JS on purpose: animated SVG props through
 * Reanimated did not redraw on the new architecture (water ring).
 */
export function useTweened(target: number, instant: boolean, durationMs: number): number {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    if (instant || from === target) {
      current.current = target;
      setValue(target);
      return;
    }
    const start = Date.now();
    let frame = requestAnimationFrame(function step() {
      const t = Math.min((Date.now() - start) / durationMs, 1);
      current.current = from + (target - from) * easeOutCubic(t);
      setValue(current.current);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, instant, durationMs]);
  return value;
}
