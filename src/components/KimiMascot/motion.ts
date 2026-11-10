// Micro-animations of the mascot's eyes (MascotEyes). Times in ms, ranges are [min, max] and
// picked at random each time. Adjust here.

import type { EyesPose } from './eyeShapes';

export type Range = readonly [number, number];

export const MASCOT_MOTION = {
  blink: {
    /** Time between blinks (independent from the glances). */
    every: [3000, 7000] as Range,
    /** Eyelid down, then up (~150 ms in all). */
    halfMs: 75,
    /** Chance of a double blink, and the pause between its two blinks. */
    doubleChance: 0.25,
    doubleGapMs: 90,
    /** A blink due within this long of a glance starting moves to the middle of its move. */
    syncWindowMs: 1200,
  },
  look: {
    /** Time between the start of two glances (never before the previous one ended). */
    every: [2500, 5000] as Range,
    /** Pupil shift to the side, in SVG units. */
    offset: 20,
    /** Going to a side (and coming back). */
    moveMs: [150, 200] as Range,
    /** Time on the side before coming back. */
    holdMs: [600, 1500] as Range,
    /** Chances of each glance: a quick double (left, then right) and staying centered. */
    doubleChance: 0.25,
    centerChance: 0.2,
    /** Double glance: short stop on the left before going right. */
    doubleFirstHoldMs: [250, 400] as Range,
  },
  anger: {
    /** Angry brows stay this long. */
    holdMs: 1000,
    fadeMs: 120,
  },
} as const;

type Widen<T> = T extends readonly [number, number] ? Range : T extends number ? number : T;
export type MascotMotion = { [G in keyof typeof MASCOT_MOTION]: { [K in keyof (typeof MASCOT_MOTION)[G]]: Widen<(typeof MASCOT_MOTION)[G][K]> } };
type MotionOverride = { [G in keyof MascotMotion]?: Partial<MascotMotion[G]> };

/** Per pose, on top of MASCOT_MOTION: the movement keeps the pose's expression. */
const POSE_MOTION: Partial<Record<EyesPose | 'team' | 'thirsty', MotionOverride>> = {
  // Smug: lids half closed (the eye shape), small glances.
  streak: { look: { offset: 12 } },
  // Angry: the angry brows stay longer.
  team: { anger: { holdMs: 1800 } },
  // Tired: slow blinks (~250 ms) and slow glances, no energy.
  thirsty: { blink: { halfMs: 125 }, look: { moveMs: [320, 450] } },
};

const cache = new Map<EyesPose, MascotMotion>();

/** Motion of a pose (stable object per pose). */
export function motionFor(pose: EyesPose): MascotMotion {
  let m = cache.get(pose);
  if (!m) {
    const o = POSE_MOTION[pose] ?? {};
    m = {
      blink: { ...MASCOT_MOTION.blink, ...o.blink },
      look: { ...MASCOT_MOTION.look, ...o.look },
      anger: { ...MASCOT_MOTION.anger, ...o.anger },
    };
    cache.set(pose, m);
  }
  return m;
}

/**
 * Peek of the `graduation` pose (PeekEye): the closed right eye opens a crack, glances around
 * and shuts fast, as if caught. Twice, then stops. Times in ms; x shifts in SVG units.
 */
export const PEEK_MOTION = {
  /** First peek after the achievement screen opens. */
  startDelayMs: 1500,
  /** From the end of one peek to the start of the next. */
  gapMs: 4000,
  peeks: 2,
  /** The crack opens (scaleY 0 → 1 from the upper lid line). */
  openMs: 200,
  /** Glance left, hold, back to the centre, a little to the right, back. */
  left: -30,
  right: 10,
  toLeftMs: 220,
  holdLeftMs: 400,
  backMs: 200,
  toRightMs: 150,
  fromRightMs: 150,
  /** Looking ahead before shutting. */
  holdFrontMs: 500,
  /** Shuts quickly (scaleY → 0). */
  closeMs: 120,
} as const;
