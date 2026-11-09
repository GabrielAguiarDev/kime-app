import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { Pressable, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { useAppTheme } from '@theme';

import { GuardEyes, type GuardEyesHandle } from './GuardEyes';

// Poses (DESIGN-SYSTEM.md, section 4): 1254×1254, transparent, same head scale, feet on the
// same line. Never recolor, distort, or add outlines/shadows.
const POSES = {
  guard: require('../../../assets/mascot/guard.png'),
  team: require('../../../assets/mascot/team.png'),
  streak: require('../../../assets/mascot/streak.png'),
  graduation: require('../../../assets/mascot/graduation.png'),
  thirsty: require('../../../assets/mascot/thirsty.png'),
} as const;
const GUARD_NO_EYES = require('../../../assets/mascot/guard-no-eyes.png');

export type KimiPose = keyof typeof POSES;

/** hero: achievements, onboarding and the app intro; empty: empty states and the Jornada; feedback: feedback sheet and balloon. */
export type MascotSize = 'hero' | 'empty' | 'feedback';

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
  /** Micro-animations (blinks, glances, angry brows on tap). Only the `guard` pose animates. */
  animated?: boolean;
  /** Plays the angry brows when it turns true (also on mount), e.g. an error. */
  angry?: boolean;
  /** Rendered outside a navigator screen (the app intro): screen focus is not tracked. */
  outsideScreen?: boolean;
  ref?: Ref<KimiMascotHandle>;
}

/**
 * Kimi mascot. Static PNG of the pose; `guard` + `animated` stacks guard-no-eyes.png and the
 * vector eyes (GuardEyes). Static with "Reduce motion". The idle loop pauses while the
 * screen is not focused or the app is in the background.
 */
export function KimiMascot({ size, pose = 'guard', animated = false, angry, outsideScreen, ref }: KimiMascotProps) {
  const { size: sizes } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const px = { hero: sizes.mascotHero, empty: sizes.mascotEmpty, feedback: sizes.mascotFeedback }[size];

  if (!animated || pose !== 'guard' || reduceMotion) {
    return <Image source={POSES[pose]} style={{ width: px, height: px }} contentFit="contain" accessible={false} />;
  }
  return outsideScreen ? (
    <AnimatedGuard px={px} focused angry={angry} handleRef={ref} />
  ) : (
    <FocusedGuard px={px} angry={angry} handleRef={ref} />
  );
}

interface AnimatedGuardProps {
  px: number;
  focused: boolean;
  angry?: boolean;
  handleRef?: Ref<KimiMascotHandle>;
}

function FocusedGuard(props: Omit<AnimatedGuardProps, 'focused'>) {
  return <AnimatedGuard {...props} focused={useIsFocused()} />;
}

function AnimatedGuard({ px, focused, angry, handleRef }: AnimatedGuardProps) {
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
    <Pressable
      onPress={() => eyes.current?.angry()}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ width: px, height: px }}
    >
      <View style={{ width: px, height: px }}>
        <Image source={GUARD_NO_EYES} style={{ width: px, height: px }} contentFit="contain" accessible={false} />
        <GuardEyes idle={focused} ref={eyes} />
      </View>
    </Pressable>
  );
}
