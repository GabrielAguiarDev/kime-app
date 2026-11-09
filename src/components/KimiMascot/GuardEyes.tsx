import { useEffect, useImperativeHandle, type Ref } from 'react';
import { AppState } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { GUARD_EYES, type GuardEye } from './guardEyesShapes';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Eyelid: half the blink down, half up (~150 ms in all). */
const BLINK_HALF_MS = 75;
/** Pause between the two blinks of a double blink. */
const DOUBLE_BLINK_GAP_MS = 90;
/** Chance of a double blink. */
const DOUBLE_BLINK_CHANCE = 0.25;
const BLINK_EVERY_MS: [number, number] = [3000, 7000];

/** Pupils move this much (SVG units) sideways, stay, and come back. */
const LOOK_OFFSET = 20;
const LOOK_MOVE_MS = 180;
const LOOK_HOLD_MS = 1000;
const LOOK_EVERY_MS: [number, number] = [8000, 15000];

/** Angry brows stay this long. */
const ANGER_HOLD_MS = 1000;
const ANGER_FADE_MS = 120;

/** At rest the eyelid sits this far above its closed position: out of the clipped eye. */
const LID_CLEARANCE = 20;

const between = ([min, max]: [number, number]) => min + Math.random() * (max - min);

export interface GuardEyesHandle {
  blink: () => void;
  /** Swaps the brows for the angry ones for ~1 s. */
  angry: () => void;
}

interface GuardEyesProps {
  /** Runs the idle loop (blinks and glances). Off: eyes open and still. */
  idle: boolean;
  ref?: Ref<GuardEyesHandle>;
}

function blinkTo(lid: SharedValue<number>, double: boolean) {
  const down = () => withTiming(1, { duration: BLINK_HALF_MS });
  const up = () => withTiming(0, { duration: BLINK_HALF_MS });
  lid.set(
    double
      ? withSequence(down(), up(), withDelay(DOUBLE_BLINK_GAP_MS, down()), up())
      : withSequence(down(), up()),
  );
}

/**
 * Eyes of the "guard" pose (assets/mascot/guard-eyes.svg, via guardEyesShapes.ts) drawn
 * over guard-no-eyes.png, same size. Eyelids, pupils and brows move with Reanimated.
 */
export function GuardEyes({ idle, ref }: GuardEyesProps) {
  // 0 open → 1 closed.
  const lid = useSharedValue(0);
  // -1 left … 1 right.
  const look = useSharedValue(0);
  // 0 normal brows → 1 angry brows.
  const anger = useSharedValue(0);

  useImperativeHandle(
    ref,
    () => ({
      blink: () => blinkTo(lid, false),
      angry: () => {
        anger.set(withSequence(
          withTiming(1, { duration: ANGER_FADE_MS }),
          withDelay(ANGER_HOLD_MS, withTiming(0, { duration: ANGER_FADE_MS })),
        ));
      },
    }),
    [lid, anger],
  );

  // Idle loop: only while visible (`idle`) and the app is in the foreground.
  useEffect(() => {
    if (!idle) return;
    let blinkTimer: ReturnType<typeof setTimeout> | undefined;
    let lookTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleBlink = () => {
      blinkTimer = setTimeout(() => {
        blinkTo(lid, Math.random() < DOUBLE_BLINK_CHANCE);
        scheduleBlink();
      }, between(BLINK_EVERY_MS));
    };
    const scheduleLook = () => {
      lookTimer = setTimeout(() => {
        const side = Math.random() < 0.5 ? -1 : 1;
        look.set(withSequence(
          withTiming(side, { duration: LOOK_MOVE_MS }),
          withDelay(LOOK_HOLD_MS, withTiming(0, { duration: LOOK_MOVE_MS })),
        ));
        scheduleLook();
      }, between(LOOK_EVERY_MS));
    };
    const start = () => {
      scheduleBlink();
      scheduleLook();
    };
    const stop = () => {
      clearTimeout(blinkTimer);
      clearTimeout(lookTimer);
      cancelAnimation(lid);
      cancelAnimation(look);
      lid.set(0);
      look.set(0);
    };

    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (state) => {
      stop();
      if (state === 'active') start();
    });
    return () => {
      sub.remove();
      stop();
    };
  }, [idle, lid, look]);

  return (
    <Svg width="100%" height="100%" viewBox={GUARD_EYES.viewBox} style={{ position: 'absolute' }} pointerEvents="none">
      <G transform={GUARD_EYES.rootTransform}>
        <Defs>
          <ClipPath id="kimi-clip-eye-left">
            <Path d={GUARD_EYES.left.clip} />
          </ClipPath>
          <ClipPath id="kimi-clip-eye-right">
            <Path d={GUARD_EYES.right.clip} />
          </ClipPath>
        </Defs>
        <Eye eye={GUARD_EYES.left} clipId="kimi-clip-eye-left" lid={lid} look={look} anger={anger} />
        <Eye eye={GUARD_EYES.right} clipId="kimi-clip-eye-right" lid={lid} look={look} anger={anger} />
      </G>
    </Svg>
  );
}

interface EyeProps {
  eye: GuardEye;
  clipId: string;
  lid: SharedValue<number>;
  look: SharedValue<number>;
  anger: SharedValue<number>;
}

function Eye({ eye, clipId, lid, look, anger }: EyeProps) {
  const { eyelid, pupil, shine } = eye;
  const restOffset = eyelid.height + LID_CLEARANCE;

  const lidProps = useAnimatedProps(() => ({ y: eyelid.y - restOffset * (1 - lid.value) }));
  const pupilProps = useAnimatedProps(() => ({ cx: pupil.cx + LOOK_OFFSET * look.value }));
  const shineProps = useAnimatedProps(() => ({ cx: shine.cx + LOOK_OFFSET * look.value }));
  const angryProps = useAnimatedProps(() => ({ opacity: anger.value }));
  const browProps = useAnimatedProps(() => ({ opacity: 1 - anger.value }));

  return (
    <G>
      <Path d={eye.white.d} fill={eye.white.fill} />
      <G clipPath={`url(#${clipId})`}>
        <Path
          d={eye.shade.d}
          fill="none"
          stroke={eye.shade.stroke}
          strokeWidth={eye.shade.strokeWidth}
          opacity={eye.shade.opacity}
        />
        <AnimatedCircle animatedProps={pupilProps} cy={pupil.cy} r={pupil.r} fill={pupil.fill} />
        <AnimatedCircle animatedProps={shineProps} cy={shine.cy} r={shine.r} fill={shine.fill} />
        <AnimatedRect
          animatedProps={lidProps}
          x={eyelid.x}
          width={eyelid.width}
          height={eyelid.height}
          fill={eyelid.fill}
        />
      </G>
      <AnimatedG animatedProps={angryProps}>
        {eye.browAngry.map((p) => (
          <Path key={p.d.slice(0, 24) + p.fill} d={p.d} fill={p.fill} />
        ))}
      </AnimatedG>
      <AnimatedPath animatedProps={browProps} d={eye.brow.d} fill={eye.brow.fill} />
    </G>
  );
}
