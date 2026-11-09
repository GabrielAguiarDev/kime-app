import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import { useEffect, useImperativeHandle, useRef, type ReactNode, type Ref } from 'react';
import { Pressable, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { useAppTheme } from '@theme';

import { GuardEyes, type GuardEyesHandle } from './GuardEyes';
import { BUST_WINDOWS, GUARD_NO_EYES, POSE_IMAGE_SIZE, POSE_SOURCES, type KimiPose, type PoseWindow } from './poses';

export type { KimiPose } from './poses';

/**
 * hero: achievements, onboarding and the app intro; empty: empty states and the Jornada;
 * feedback: balloon and small feedback; sheet: bust in the feedback sheet. With crop="bust"
 * the size is the height of the visible window.
 */
export type MascotSize = 'hero' | 'empty' | 'feedback' | 'sheet';

/** Full image (default) or only the head-to-waist window of the pose (poses.ts, BUST_WINDOWS). */
export type MascotCrop = 'full' | 'bust';

export interface KimiMascotHandle {
  /** Angry brows for ~1 s. Does nothing while static. */
  angry: () => void;
  /** One blink. Does nothing while static. */
  blink: () => void;
}

export interface KimiMascotProps {
  size: MascotSize;
  /** Default `guard`. */
  pose?: KimiPose;
  /** Default `full`. */
  crop?: MascotCrop;
  /** Micro-animations (blinks, glances, angry brows on tap). Only the `guard` pose animates. */
  animated?: boolean;
  /** Plays the angry brows when it turns true (also on mount), e.g. an error. */
  angry?: boolean;
  /** Rendered outside a navigator screen (the app intro): screen focus is not tracked. */
  outsideScreen?: boolean;
  ref?: Ref<KimiMascotHandle>;
}

export function useMascotPx(size: MascotSize): number {
  const { size: sizes } = useAppTheme();
  return { hero: sizes.mascotHero, empty: sizes.mascotEmpty, feedback: sizes.mascotFeedback, sheet: sizes.mascotSheet }[size];
}

/** Width of the bust of `pose` drawn `height` tall (the window keeps its aspect ratio). */
export function bustWidth(pose: KimiPose, height: number): number {
  const w = BUST_WINDOWS[pose];
  return (w.width / w.height) * height;
}

/**
 * Kimi mascot. Static PNG of the pose; `guard` + `animated` stacks guard-no-eyes.png and the
 * vector eyes (GuardEyes). Static with "Reduce motion". The idle loop pauses while the
 * screen is not focused or the app is in the background. crop="bust" draws the whole image
 * and clips it to the pose window (no distortion); base and eyes are clipped together.
 */
export function KimiMascot({ size, pose = 'guard', crop = 'full', animated = false, angry, outsideScreen, ref }: KimiMascotProps) {
  const reduceMotion = useReducedMotion();
  const px = useMascotPx(size);
  const window = crop === 'bust' ? BUST_WINDOWS[pose] : null;

  if (!animated || pose !== 'guard' || reduceMotion) {
    return (
      <Frame px={px} window={window}>
        {(side) => <Image source={POSE_SOURCES[pose]} style={{ width: side, height: side }} contentFit="contain" accessible={false} />}
      </Frame>
    );
  }
  return outsideScreen ? (
    <AnimatedGuard px={px} window={window} focused angry={angry} handleRef={ref} />
  ) : (
    <FocusedGuard px={px} window={window} angry={angry} handleRef={ref} />
  );
}

/**
 * Box of the mascot. Full: `px` square. Bust: the window `px` tall, clipping the whole image
 * (side = 1254 scaled) moved so the window shows.
 */
function Frame({ px, window, children }: { px: number; window: PoseWindow | null; children: (side: number) => ReactNode }) {
  if (!window) return <View style={{ width: px, height: px }}>{children(px)}</View>;
  const scale = px / window.height;
  const side = POSE_IMAGE_SIZE * scale;
  return (
    <View style={{ width: window.width * scale, height: px, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: -window.x * scale, top: -window.y * scale, width: side, height: side }}>
        {children(side)}
      </View>
    </View>
  );
}

interface AnimatedGuardProps {
  px: number;
  window: PoseWindow | null;
  focused: boolean;
  angry?: boolean;
  handleRef?: Ref<KimiMascotHandle>;
}

function FocusedGuard(props: Omit<AnimatedGuardProps, 'focused'>) {
  return <AnimatedGuard {...props} focused={useIsFocused()} />;
}

function AnimatedGuard({ px, window, focused, angry, handleRef }: AnimatedGuardProps) {
  const eyes = useRef<GuardEyesHandle>(null);

  useImperativeHandle(
    handleRef,
    () => ({
      angry: () => eyes.current?.angry(),
      blink: () => eyes.current?.blink(),
    }),
    [],
  );

  useEffect(() => {
    if (angry) eyes.current?.angry();
  }, [angry]);

  return (
    // Decorative: a tap only makes him angry.
    <Pressable onPress={() => eyes.current?.angry()} accessible={false} importantForAccessibility="no-hide-descendants">
      <Frame px={px} window={window}>
        {(side) => (
          <View style={{ width: side, height: side }}>
            <Image source={GUARD_NO_EYES} style={{ width: side, height: side }} contentFit="contain" accessible={false} />
            <GuardEyes idle={focused} ref={eyes} />
          </View>
        )}
      </Frame>
    </Pressable>
  );
}
