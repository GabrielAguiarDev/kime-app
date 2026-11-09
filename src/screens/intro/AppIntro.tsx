import { SplashScreen } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Box, KimiMascot, Text, type KimiMascotHandle } from '@components';
import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

/** "KIMI" has finished rising (ms from the start). */
const TEXT_DONE_MS = 1400;
/** Pause with the name and the mascot on screen before leaving, so both can be seen. */
const HOLD_MS = 600;
/** The intro never leaves before this (ms from the start). */
export const INTRO_MIN_MS = TEXT_DONE_MS + HOLD_MS;
const EXIT_MS = 250;
/** Text rises this much while it appears. */
const TEXT_RISE = 12;

/**
 * Smoke timeline (ms), one continuous motion: the clouds are born small on the feet line and
 * grow rising until SMOKE_COVER_MS (bottom ones first), then clear in place, still rising,
 * until SMOKE_END_MS. Fully opaque until the clearing starts.
 */
const SMOKE_COVER_MS = 450;
const SMOKE_END_MS = 1000;
/** The ninja is switched on (no fade), already fully covered by the smoke. */
const NINJA_ON_MS = 400;
/** While clearing, the clouds rise this much more (pt, 200 mascot) and grow this much. */
const CLEAR_RISE = 24;
const CLEAR_GROW = 0.12;
/** Size of a newborn cloud on the feet line (fraction of its full size). */
const BORN_SCALE = 0.15;

/** smoke-cloud of assets/brand/kimi-props.svg (centered on 0,0). */
const SMOKE_CIRCLES = [
  { cx: -48, cy: 14, r: 30, fill: '#7D8087' },
  { cx: 48, cy: 14, r: 30, fill: '#7D8087' },
  { cx: 0, cy: 20, r: 36, fill: '#7D8087' },
  { cx: -44, cy: 6, r: 28, fill: '#9EA0A6' },
  { cx: 44, cy: 6, r: 28, fill: '#9EA0A6' },
  { cx: -18, cy: -22, r: 32, fill: '#9EA0A6' },
  { cx: 22, cy: -18, r: 30, fill: '#9EA0A6' },
  { cx: 0, cy: 8, r: 34, fill: '#9EA0A6' },
  { cx: -24, cy: -30, r: 12, fill: '#C4C6CB' },
  { cx: 16, cy: -28, r: 9, fill: '#C4C6CB' },
] as const;
const SMOKE_W = 160;
const SMOKE_H = 120;

/**
 * Clouds, in pt for a 200 mascot (scaled with the token), relative to the mascot center, at
 * full cover. Centered on the body (x ≈ 2) and grouped on the ninja (x −57…86 with the
 * headband tips, y −62…92): together they span about x −95…100, y −90…107, and hide every
 * pixel of guard.png from NINJA_ON_MS until the clearing (checked against the PNG alpha).
 * `start`: when it is born (bottom first).
 */
const CLOUDS = [
  { x: -30, y: 60, size: 135, rotate: 0, start: 0 },
  { x: 28, y: 62, size: 130, rotate: 180, start: 40 },
  { x: 0, y: 12, size: 170, rotate: 0, start: 80 },
  { x: 38, y: -16, size: 125, rotate: -15, start: 120 },
  { x: -16, y: -36, size: 155, rotate: 8, start: 160 },
] as const;
const CLOUD_BASE = 200;
/**
 * The poses are centered on the head; in guard the body (trunk and legs) has its center at
 * x 640 of 1254, not 627. Only here, the mascot (and the smoke, drawn around it) moves left
 * by that fraction of its width (~1%), so the body is centered on screen, on the same
 * vertical line as "KIMI". The headband tips may go past it to the right.
 */
const BODY_CENTER_SHIFT = (640 - 627) / 1254;

/** Feet line of the ninja (pt from the mascot center, 200 mascot): where the clouds are born. */
const FEET_Y = 92;

const out = Easing.out(Easing.cubic);

function SmokeCloud({ time, cloud, k }: { time: SharedValue<number>; cloud: (typeof CLOUDS)[number]; k: number }) {
  const style = useAnimatedStyle(() => {
    const t = time.value;
    // Growing and rising from the feet line, easing into its cover position at SMOKE_COVER_MS.
    const u = Math.min(Math.max((t - cloud.start) / (SMOKE_COVER_MS - cloud.start), 0), 1);
    const grow = 1 - Math.pow(1 - u, 3);
    // Clearing in place: keeps rising (from rest, so the motion stays continuous) and fades.
    const c = Math.min(Math.max((t - SMOKE_COVER_MS) / (SMOKE_END_MS - SMOKE_COVER_MS), 0), 1);
    const clear = c * c;
    return {
      opacity: t < cloud.start ? 0 : 1 - c,
      transform: [
        { translateX: k * cloud.x },
        { translateY: k * (FEET_Y + (cloud.y - FEET_Y) * grow - CLEAR_RISE * clear) },
        { rotate: `${cloud.rotate}deg` },
        { scale: (BORN_SCALE + (1 - BORN_SCALE) * grow) * (1 + CLEAR_GROW * clear) },
      ],
    };
  });
  const width = cloud.size * k;
  const height = (width * SMOKE_H) / SMOKE_W;
  return (
    <Animated.View style={[{ position: 'absolute', left: -width / 2, top: -height / 2, width, height }, style]}>
      <Svg width="100%" height="100%" viewBox={`${-SMOKE_W / 2} ${-SMOKE_H / 2} ${SMOKE_W} ${SMOKE_H}`}>
        {SMOKE_CIRCLES.map((c, i) => (
          <Circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill={c.fill} />
        ))}
      </Svg>
    </Animated.View>
  );
}

interface AppIntroProps {
  /** The app finished loading: the intro may leave (after INTRO_MIN_MS). */
  ready: boolean;
  /** Called once the exit finished. Must be stable (useCallback). */
  onDone: () => void;
}

/**
 * App opening (every cold start, students and staff alike), over the app while it loads.
 * The native splash is only the background color; it hides as soon as this layer is laid
 * out, so the handoff is invisible. The ninja is never seen appearing: the smoke (in front)
 * rises from his feet until it covers him, he is switched on behind it, and the smoke clears
 * in place to reveal him; then a blink, angry brows and "KIMI". Leaves after INTRO_MIN_MS once the app is
 * ready; while it is not, the ninja stays with the eye micro-animations. "Reduce motion":
 * no smoke, no scale; static mascot and text with a plain fade.
 */
export function AppIntro({ ready, onDone }: AppIntroProps) {
  const reduceMotion = useReducedMotion();
  const { size } = useAppTheme();
  const px = size.mascotHero;
  const mascot = useRef<KimiMascotHandle>(null);
  const [running, setRunning] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const started = useRef(false);
  const leaving = useRef(false);

  const smoke = useSharedValue(0);
  const ninja = useSharedValue(0); // opacity 0 → 1
  const text = useSharedValue(0); // 0 hidden → 1 shown
  const exit = useSharedValue(0); // 0 → 1 leaving

  const start = useCallback(() => {
    if (started.current) return;
    started.current = true;
    SplashScreen.hide();
    setRunning(true);

    if (reduceMotion) {
      ninja.set(withDelay(300, withTiming(1, { duration: 500 })));
    } else {
      // Linear clock; each cloud eases its own part (SmokeCloud).
      smoke.set(withTiming(SMOKE_END_MS, { duration: SMOKE_END_MS, easing: Easing.linear }));
      // At once (no fade, no scale), already hidden behind the smoke.
      ninja.set(withDelay(NINJA_ON_MS, withTiming(1, { duration: 0 })));
    }
    text.set(withDelay(1100, withTiming(1, { duration: 300, easing: out })));
  }, [reduceMotion, smoke, ninja, text]);

  // Haptic as the smoke starts clearing, then the blink and the angry brows; minimum time on screen.
  useEffect(() => {
    if (!running) return;
    const timers = [
      setTimeout(() => void haptics.intro(), reduceMotion ? 300 : SMOKE_COVER_MS),
      setTimeout(() => mascot.current?.blink(), 1000),
      setTimeout(() => mascot.current?.angry(), 1150),
      setTimeout(() => setMinElapsed(true), INTRO_MIN_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [running, reduceMotion]);

  useEffect(() => {
    if (!minElapsed || !ready || leaving.current) return;
    leaving.current = true;
    exit.set(
      // Done even if the timing is interrupted: the layer must never stay over the app.
      withTiming(1, { duration: EXIT_MS, easing: Easing.in(Easing.quad) }, () => {
        scheduleOnRN(onDone);
      }),
    );
  }, [minElapsed, ready, exit, onDone]);

  const layerStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduceMotion ? 1 : 1 - 0.08 * exit.value }],
  }));
  const ninjaStyle = useAnimatedStyle(() => ({ opacity: ninja.value }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: text.value,
    transform: [{ translateY: reduceMotion ? 0 : TEXT_RISE * (1 - text.value) }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, layerStyle]} onLayout={start} accessibilityViewIsModal>
      <Box flex={1} backgroundColor="bg" alignItems="center" justifyContent="center">
        <Animated.View style={[{ alignItems: 'center' }, contentStyle]}>
          <Box width={px} height={px} style={{ transform: [{ translateX: -BODY_CENTER_SHIFT * px }] }}>
            <Animated.View style={ninjaStyle}>
              <KimiMascot ref={mascot} size="hero" animated outsideScreen />
            </Animated.View>
            {reduceMotion ? null : (
              // In front of the ninja: zero-size anchor at the mascot center, clouds centered on it.
              <Box position="absolute" width={0} height={0} pointerEvents="none" style={{ left: px / 2, top: px / 2, zIndex: 1 }}>
                {CLOUDS.map((cloud, i) => (
                  <SmokeCloud key={i} time={smoke} cloud={cloud} k={px / CLOUD_BASE} />
                ))}
              </Box>
            )}
          </Box>
          <Animated.View style={textStyle}>
            <Text variant="displayXl">
              KIMI
            </Text>
          </Animated.View>
        </Animated.View>
      </Box>
    </Animated.View>
  );
}
