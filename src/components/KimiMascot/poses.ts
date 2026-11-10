// Mascot poses (DESIGN-SYSTEM.md, section 4): 1254×1254, transparent, same head scale, feet
// on the same line. Never recolor, distort, or add outlines/shadows.

import { EYES_POSES, type EyesPose } from './eyeShapes';

/** Side of every pose image, in image pixels. */
export const POSE_IMAGE_SIZE = 1254;

export const POSE_SOURCES = {
  guard: require('../../../assets/mascot/guard.png'),
  team: require('../../../assets/mascot/team.png'),
  streak: require('../../../assets/mascot/streak.png'),
  graduation: require('../../../assets/mascot/graduation.png'),
  thirsty: require('../../../assets/mascot/thirsty.png'),
} as const;

/**
 * Poses with animated eyes: the pose without the eyes; the vector eyes ({pose}-eyes.svg, via
 * eyeShapes.ts) go over it 1:1. `graduation` has its eyes closed: always static.
 */
export const NO_EYES_SOURCES: Record<EyesPose, number> = {
  guard: require('../../../assets/mascot/guard-no-eyes.png'),
  streak: require('../../../assets/mascot/streak-no-eyes.png'),
  team: require('../../../assets/mascot/team-no-eyes.png'),
  thirsty: require('../../../assets/mascot/thirsty-no-eyes.png'),
};

export type KimiPose = keyof typeof POSE_SOURCES;

export function hasAnimatedEyes(pose: KimiPose): pose is EyesPose {
  return (EYES_POSES as readonly string[]).includes(pose);
}

export interface PoseWindow {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * crop="bust": the window of each pose that is shown, head to waist, in image pixels of the
 * 1254×1254 PNG (x, y, width, height). The image is drawn whole and clipped to it, never
 * distorted. Adjust here.
 */
export const BUST_WINDOWS: Record<KimiPose, PoseWindow> = {
  guard: { x: 180, y: 206, width: 1020, height: 760 },
  team: { x: 180, y: 137, width: 1020, height: 760 },
  streak: { x: 180, y: 48, width: 1020, height: 760 },
  graduation: { x: 180, y: 87, width: 1020, height: 760 },
  // Taller: down to the bottom of the bottle (y 922), above the drops (from y 931).
  thirsty: { x: 150, y: 96, width: 1050, height: 830 },
};
