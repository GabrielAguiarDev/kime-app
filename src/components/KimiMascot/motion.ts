// Micro-animations of the guard pose (GuardEyes). Times in ms, ranges are [min, max] and
// picked at random each time. Adjust here.

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
