import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import type { ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Box, MascotEyes } from '@components';
import { useAppTheme } from '@theme';

import { SIGN_IN_NINJA_EYES, SIGN_IN_NINJA_LOOK_OFFSET } from './signInNinjaEyes';

const NINJA = require('../../../assets/auth/sign-in-ninja.png');
const WAVE = require('../../../assets/auth/sign-in-wave.png');

// sign-in-ninja.png is 1448×1086 with transparent margins: the drawing spans
// y 142–866. The hero shows only that band (plus a little air).
const NINJA_W = 1448;
const NINJA_H = 1086;
const CROP_TOP = 112;
const CROP_BOTTOM = 906;
// The drawing as wide as the screen, pushed right,
// so the ninja sits on the right edge (headband cut).
const WIDTH_FACTOR = 1.0;
const LEFT_FACTOR = 0.08;

/**
 * Top of the sign-in screen: the ninja with the orange stroke, edge to edge,
 * and the title (`children`) over its left side, above the stroke.
 */
export function SignInHero({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const { spacing } = useAppTheme();
  const scale = (width * WIDTH_FACTOR) / NINJA_W;
  const focused = useIsFocused();
  // Same rule as the app's mascot: still eyes with "Reduce motion" (the PNG has its own).
  const reduceMotion = useReducedMotion();

  return (
    <Box style={{ marginHorizontal: -spacing.screenMargin, height: (CROP_BOTTOM - CROP_TOP) * scale, overflow: 'hidden' }}>
      <View
        style={{
          position: 'absolute',
          left: width * LEFT_FACTOR,
          top: -CROP_TOP * scale,
          width: NINJA_W * scale,
          height: NINJA_H * scale,
        }}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      >
        <Image source={NINJA} contentFit="contain" style={{ width: '100%', height: '100%' }} accessible={false} />
        {/* Blinks and glances like the mascot in the app, drawn 1:1 over the PNG's eyes. */}
        {reduceMotion ? null : (
          <MascotEyes shape={SIGN_IN_NINJA_EYES} lookOffset={SIGN_IN_NINJA_LOOK_OFFSET} idle={focused} />
        )}
      </View>
      {/* Bottom edge sits above the left end of the stroke. */}
      <Box style={{ position: 'absolute', left: spacing.screenMargin, bottom: '26%', maxWidth: '58%' }} gap="s8">
        {children}
      </Box>
    </Box>
  );
}

/** Soft orange wave at the bottom of the sign-in screen (decorative, behind the actions). */
export function SignInWave() {
  return (
    <Image
      source={WAVE}
      contentFit="contain"
      pointerEvents="none"
      accessible={false}
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, aspectRatio: 2172 / 724 }}
    />
  );
}
