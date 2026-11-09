import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Rive, { Fit, type RiveRef } from 'rive-react-native';

import { BELT_COLOR_KEYS, BELT_EXTRA_COLOR_KEYS } from '@domain/Classes/classesRules';
import type { BeltColorKey } from '@domain/Classes/classesTypes';
import { useAppTheme } from '@theme';

import { Mascot, type MascotExpression, type MascotSize } from '../Mascot/Mascot';
import KIMI_RIV from './kimiRiv';

/** Names inside assets/brand/kimi.riv (DEVELOPMENT.md, "Animações do mascote (Rive)"). */
export const KIMI_ARTBOARD = 'Kimi';
export const KIMI_STATE_MACHINE = 'Kimi';

/** Trigger inputs of the "Kimi" state machine. Every animation leaves and returns to the idle state. */
export type KimiTrigger = 'intro' | 'joinTeam' | 'streak' | 'graduate' | 'celebrate' | 'error';

/**
 * Number sent to the `beltColor` input: the position of the color in the main
 * palette followed by the variations (white 0 … red 9, light_gray 10 … dark_red 19).
 */
export function beltColorInput(key: BeltColorKey): number {
  return [...BELT_COLOR_KEYS, ...BELT_EXTRA_COLOR_KEYS].indexOf(key);
}

/** True when the Rive mascot can play: the file exists and "Reduce motion" is off. */
export function useKimiAnimates(): boolean {
  const reduceMotion = useReducedMotion();
  return KIMI_RIV !== null && !reduceMotion;
}

export interface KimiMascotHandle {
  /** Fires a trigger input. Does nothing while static (no file, reduce motion, `still`) or still loading. */
  fire: (trigger: KimiTrigger) => void;
}

export interface KimiMascotProps {
  size: MascotSize;
  /** Expression of the static SVG (fallback). */
  expression?: MascotExpression;
  /** Trigger fired once, as soon as the state machine starts. */
  play?: KimiTrigger;
  /** Color of the new belt (`beltColor` input), set before `play`. */
  beltColor?: BeltColorKey | null;
  isAngry?: boolean;
  coverEyes?: boolean;
  /** Where the eyes look, 0 (left) to 100 (right). */
  lookX?: number;
  /** Always the static SVG (e.g. staff screens). */
  still?: boolean;
  /** Called when the animation starts playing (never while static). */
  onStart?: () => void;
  ref?: Ref<KimiMascotHandle>;
}

/**
 * Kimi mascot with the Rive state machine (assets/brand/kimi.riv). Shows the
 * static SVG (same props) while the file does not exist, when the user turned
 * on "Reduce motion", with `still`, or if the file fails to load.
 */
export function KimiMascot({
  size,
  expression,
  play,
  beltColor,
  isAngry,
  coverEyes,
  lookX,
  still = false,
  onStart,
  ref,
}: KimiMascotProps) {
  const { size: sizes } = useAppTheme();
  const animates = useKimiAnimates();
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);
  const rive = useRef<RiveRef>(null);
  const played = useRef(false);
  const live = animates && !still && !failed && KIMI_RIV !== null;

  useImperativeHandle(
    ref,
    () => ({
      fire: (trigger) => {
        if (live && started) rive.current?.fireState(KIMI_STATE_MACHINE, trigger);
      },
    }),
    [live, started],
  );

  // State inputs follow the props once the state machine is running.
  useEffect(() => {
    const r = rive.current;
    if (!live || !started || !r) return;
    if (beltColor) r.setInputState(KIMI_STATE_MACHINE, 'beltColor', beltColorInput(beltColor));
    if (isAngry !== undefined) r.setInputState(KIMI_STATE_MACHINE, 'isAngry', isAngry);
    if (coverEyes !== undefined) r.setInputState(KIMI_STATE_MACHINE, 'coverEyes', coverEyes);
    if (lookX !== undefined) r.setInputState(KIMI_STATE_MACHINE, 'lookX', Math.min(100, Math.max(0, lookX)));
  }, [live, started, beltColor, isAngry, coverEyes, lookX]);

  // Declared after the inputs: `beltColor` is already set when `graduate` fires.
  useEffect(() => {
    if (!live || !started || !play || played.current) return;
    played.current = true;
    rive.current?.fireState(KIMI_STATE_MACHINE, play);
  }, [live, started, play]);

  if (!live || KIMI_RIV === null) return <Mascot size={size} expression={expression} />;

  const px = { hero: sizes.mascotHero, empty: sizes.mascotEmpty, feedback: sizes.mascotFeedback }[size];
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: px, height: px }}>
      <Rive
        ref={rive}
        source={KIMI_RIV}
        artboardName={KIMI_ARTBOARD}
        stateMachineName={KIMI_STATE_MACHINE}
        autoplay
        fit={Fit.Contain}
        style={{ width: px, height: px }}
        onPlay={() => {
          if (started) return;
          setStarted(true);
          onStart?.();
        }}
        onError={() => setFailed(true)}
      />
    </View>
  );
}
