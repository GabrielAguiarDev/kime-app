import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
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
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';

import { MASCOT_EYES, type EyesPose, type MascotEye } from './eyeShapes';
import { motionFor, type MascotMotion, type Range } from './motion';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** At rest the eyelid sits this far above its closed position: out of the clipped eye. */
const LID_CLEARANCE = 20;

const between = ([min, max]: Range) => min + Math.random() * (max - min);

export interface MascotEyesHandle {
  blink: () => void;
  /** Swaps the brows for the angry ones for ~1 s. */
  angry: () => void;
}

interface MascotEyesProps {
  pose: EyesPose;
  /** Runs the idle loop (blinks and glances). Off: eyes open and still. */
  idle: boolean;
  /**
   * First glance this long after mounting (with a blink in the middle of it) instead of the
   * random wait, e.g. right after a feedback sheet enters. Later ones keep the usual pace.
   */
  startAfterMs?: number;
  ref?: Ref<MascotEyesHandle>;
}

function blinkTo(lid: SharedValue<number>, double: boolean, BLINK: MascotMotion['blink']) {
  const down = () => withTiming(1, { duration: BLINK.halfMs });
  const up = () => withTiming(0, { duration: BLINK.halfMs });
  lid.set(
    double
      ? withSequence(down(), up(), withDelay(BLINK.doubleGapMs, down()), up())
      : withSequence(down(), up()),
  );
}

/**
 * Eyes of a pose (assets/mascot/{pose}-eyes.svg, via eyeShapes.ts) drawn over
 * {pose}-no-eyes.png, same size. Eyelids, pupils and brows move with Reanimated, with the
 * pose's motion (motion.ts).
 */
export function MascotEyes({ pose, idle, startAfterMs, ref }: MascotEyesProps) {
  const shape = MASCOT_EYES[pose];
  const { blink: BLINK, look: LOOK, anger: ANGER } = motionFor(pose);
  // 0 open → 1 closed.
  const lid = useSharedValue(0);
  // -1 left … 1 right.
  const look = useSharedValue(0);
  // 0 normal brows → 1 angry brows.
  const anger = useSharedValue(0);
  // The quick first glance happens once per mount (not again after a pause).
  const startedOnce = useRef(false);

  useImperativeHandle(
    ref,
    () => ({
      blink: () => blinkTo(lid, false, BLINK),
      angry: () => {
        anger.set(withSequence(
          withTiming(1, { duration: ANGER.fadeMs }),
          withDelay(ANGER.holdMs, withTiming(0, { duration: ANGER.fadeMs })),
        ));
      },
    }),
    [lid, anger, BLINK, ANGER],
  );

  // Idle loop: only while visible (`idle`) and the app is in the foreground. Blinks and
  // glances run on their own timers; a blink due right around a glance happens mid-move.
  useEffect(() => {
    if (!idle) return;
    let blinkTimer: ReturnType<typeof setTimeout> | undefined;
    let lookTimer: ReturnType<typeof setTimeout> | undefined;
    let nextBlinkAt = 0;

    const scheduleBlink = (delay = between(BLINK.every)) => {
      clearTimeout(blinkTimer);
      nextBlinkAt = Date.now() + delay;
      blinkTimer = setTimeout(() => {
        blinkTo(lid, Math.random() < BLINK.doubleChance, BLINK);
        scheduleBlink();
      }, delay);
    };

    /** One glance; returns how long it takes (ms). */
    const glance = (forceMove = false): number => {
      // A forced glance always moves (no "keeps looking ahead").
      const roll = forceMove ? LOOK.centerChance + Math.random() * (1 - LOOK.centerChance) : Math.random();
      const move = () => between(LOOK.moveMs);
      if (roll < LOOK.centerChance) return 0; // keeps looking ahead this time
      let firstMove: number;
      let total: number;
      if (roll < LOOK.centerChance + LOOK.doubleChance) {
        // Quick double: left, then right (checking both sides), then back.
        const [m1, m2, m3] = [move(), move(), move()];
        const stop1 = between(LOOK.doubleFirstHoldMs);
        const hold = between(LOOK.holdMs);
        look.set(
          withSequence(
            withTiming(-1, { duration: m1 }),
            withDelay(stop1, withTiming(1, { duration: m2 })),
            withDelay(hold, withTiming(0, { duration: m3 })),
          ),
        );
        firstMove = m1;
        total = m1 + stop1 + m2 + hold + m3;
      } else {
        const side = Math.random() < 0.5 ? -1 : 1;
        const [m1, m2] = [move(), move()];
        const hold = between(LOOK.holdMs);
        look.set(withSequence(withTiming(side, { duration: m1 }), withDelay(hold, withTiming(0, { duration: m2 }))));
        firstMove = m1;
        total = m1 + hold + m2;
      }
      // A blink about to happen anyway: in the middle of the move, more natural.
      if (nextBlinkAt - Date.now() < BLINK.syncWindowMs) scheduleBlink(firstMove / 2);
      return total;
    };

    const scheduleLook = (delay = between(LOOK.every), forceMove = false) => {
      lookTimer = setTimeout(() => {
        const took = glance(forceMove);
        // Next glance counted from this one's start, never before it ends.
        scheduleLook(Math.max(between(LOOK.every), took + LOOK.moveMs[1]));
      }, delay);
    };
    const start = () => {
      if (startAfterMs != null && !startedOnce.current) {
        startedOnce.current = true;
        // Blink due right then: the glance's sync puts it in the middle of the move.
        scheduleBlink(startAfterMs + 200);
        scheduleLook(startAfterMs, true);
        return;
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- BLINK/LOOK derive from `pose`
  }, [idle, pose, lid, look]);

  return (
    <Svg width="100%" height="100%" viewBox={shape.viewBox} style={{ position: 'absolute' }} pointerEvents="none">
      <G transform={shape.rootTransform}>
        <Defs>
          <ClipPath id="kimi-clip-eye-left">
            <Path d={shape.left.clip} />
          </ClipPath>
          <ClipPath id="kimi-clip-eye-right">
            <Path d={shape.right.clip} />
          </ClipPath>
        </Defs>
        <Eye eye={shape.left} clipId="kimi-clip-eye-left" lid={lid} look={look} anger={anger} lookOffset={LOOK.offset} />
        <Eye eye={shape.right} clipId="kimi-clip-eye-right" lid={lid} look={look} anger={anger} lookOffset={LOOK.offset} />
      </G>
    </Svg>
  );
}

interface EyeProps {
  eye: MascotEye;
  clipId: string;
  lid: SharedValue<number>;
  look: SharedValue<number>;
  anger: SharedValue<number>;
  /** Pupil shift to the side, in SVG units. */
  lookOffset: number;
}

function Eye({ eye, clipId, lid, look, anger, lookOffset }: EyeProps) {
  const { eyelid, pupil, shine } = eye;
  const restOffset = eyelid.height + LID_CLEARANCE;

  const lidProps = useAnimatedProps(() => ({ y: eyelid.y - restOffset * (1 - lid.value) }));
  // The ellipse is drawn in its rotated frame: a sideways shift there keeps the glance horizontal.
  const a = (pupil.angle * Math.PI) / 180;
  const pupilProps = useAnimatedProps(() => ({
    cx: pupil.cx + lookOffset * look.value * Math.cos(a),
    cy: pupil.cy - lookOffset * look.value * Math.sin(a),
  }));
  const shineProps = useAnimatedProps(() => ({ cx: shine.cx + lookOffset * look.value }));
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
        <G transform={pupil.angle ? `rotate(${pupil.angle} ${pupil.cx} ${pupil.cy})` : undefined}>
          <AnimatedEllipse animatedProps={pupilProps} rx={pupil.rx} ry={pupil.ry} fill={pupil.fill} />
        </G>
        <AnimatedCircle animatedProps={shineProps} cy={shine.cy} r={shine.r} fill={shine.fill} />
        <G transform={eyelid.transform ?? undefined}>
          <AnimatedRect
            animatedProps={lidProps}
            x={eyelid.x}
            width={eyelid.width}
            height={eyelid.height}
            fill={eyelid.fill}
          />
        </G>
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
