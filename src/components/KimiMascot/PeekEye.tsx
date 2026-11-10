import { useEffect, useRef, useState } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path } from 'react-native-svg';

import { PEEK_MOTION as P } from './motion';

// Shapes of assets/mascot/graduation-peek.svg (1254×1254, over graduation.png 1:1).
// Keep in sync with the SVG.
const LID_Y = 546;
const SLIT = 'M650 548 Q735 560 822 546 Q790 592 736 596 Q682 594 650 548 Z';
const LOWER_LID = 'M654 552 Q684 592 736 596 Q790 592 818 550';
const UPPER_LID = 'M642 546 Q735 562 828 544';
const LASH = 'M824 545 L842 530';
const INK = '#141216';

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeIn = (t: number) => t ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** Pupil keyframes after the crack opened: [duration, target x]. */
const LOOK: [number, number][] = [
  [P.toLeftMs, P.left],
  [P.holdLeftMs, P.left],
  [P.backMs, 0],
  [P.toRightMs, P.right],
  [P.fromRightMs, 0],
  [P.holdFrontMs, 0],
];
const LOOK_MS = LOOK.reduce((s, [d]) => s + d, 0);
const PEEK_MS = P.openMs + LOOK_MS + P.closeMs;

interface Frame {
  /** Crack opening, 0 closed → 1 open. */
  open: number;
  /** Pupil shift in x. */
  dx: number;
}

/** State of one peek `t` ms after it started. */
function frameAt(t: number): Frame {
  if (t < P.openMs) return { open: easeOut(t / P.openMs), dx: 0 };
  let u = t - P.openMs;
  if (u < LOOK_MS) {
    let from = 0;
    for (const [d, to] of LOOK) {
      if (u < d) return { open: 1, dx: from + (to - from) * easeInOut(u / d) };
      u -= d;
      from = to;
    }
  }
  u = t - P.openMs - LOOK_MS;
  return { open: 1 - easeIn(Math.min(u / P.closeMs, 1)), dx: 0 };
}

/**
 * Right eye of the `graduation` pose peeking (graduation-peek.svg) over graduation.png.
 * Hidden at rest (the original closed eye shows). Runs P.peeks peeks while `active`, then
 * stays hidden; a pause (screen out of focus) resumes with the peeks left. Driven from JS,
 * frame by frame: the crack is a scaleY transform, and animated SVG props through
 * Reanimated did not redraw on the new architecture (see useTweened).
 */
export function PeekEye({ active }: { active: boolean }) {
  const [frame, setFrame] = useState<Frame | null>(null);
  const left = useRef<number>(P.peeks);

  useEffect(() => {
    if (!active || left.current <= 0) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;
    const peek = () => {
      const start = Date.now();
      const step = () => {
        const t = Date.now() - start;
        if (t >= PEEK_MS) {
          setFrame(null);
          left.current -= 1;
          if (left.current > 0) timer = setTimeout(peek, P.gapMs);
          return;
        }
        setFrame(frameAt(t));
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    timer = setTimeout(peek, left.current === P.peeks ? P.startDelayMs : P.gapMs);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      setFrame(null);
    };
  }, [active]);

  if (!frame) return null;
  const open = Math.max(frame.open, 0.001);
  return (
    <Svg width="100%" height="100%" viewBox="0 0 1254 1254" style={{ position: 'absolute' }} pointerEvents="none">
      <Defs>
        <ClipPath id="kimi-clip-peek">
          <Path d={SLIT} />
        </ClipPath>
      </Defs>
      {/* Covers the original closed eye. */}
      <Ellipse cx={736} cy={558} rx={104} ry={46} fill="#FC4800" />
      {/* The crack scales from the upper lid line. */}
      <G transform={`translate(0 ${LID_Y * (1 - open)}) scale(1 ${open})`}>
        <Path d={SLIT} fill="#FCFCFC" />
        <G clipPath="url(#kimi-clip-peek)">
          <Circle cx={748 + frame.dx} cy={584} r={27} fill={INK} />
          <Circle cx={758 + frame.dx} cy={572} r={8} fill="#FFFFFF" />
        </G>
        <Path d={LOWER_LID} fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      </G>
      <Path d={UPPER_LID} fill="none" stroke={INK} strokeWidth={13} strokeLinecap="round" />
      <Path d={LASH} fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
    </Svg>
  );
}
