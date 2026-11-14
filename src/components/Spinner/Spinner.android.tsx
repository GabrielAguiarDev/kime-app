import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

import { useAppTheme } from '@theme';

import type { SpinnerProps } from './types';

/** Same look as the iOS system indicator (UIActivityIndicatorView, medium). */
const SIZE = 20;
const BARS = 12;
const BAR_WIDTH = 2;
const BAR_LENGTH = 5.5;
/** One full turn, in steps of one bar (like iOS, it ticks instead of gliding). */
const TURN_MS = 1000;

// Discrete rotation: holds each step, then jumps to the next bar.
const STEP = 1 / BARS;
const INPUT = Array.from({ length: BARS * 2 }, (_, i) => (Math.floor(i / 2) + (i % 2)) * STEP - (i % 2 ? 0.0001 : 0));
const OUTPUT = Array.from({ length: BARS * 2 }, (_, i) => `${Math.floor(i / 2) * (360 / BARS)}deg`);

/**
 * Android: iOS-style activity indicator (12 rounded bars, fading tail, stepped
 * rotation), drawn with plain views. Default color: `textMuted` (the system gray on iOS).
 */
export function Spinner({ color, accessibilityLabel }: SpinnerProps) {
  const { colors } = useAppTheme();
  const tint = color ?? colors.textMuted;
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: TURN_MS, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const rotate = progress.interpolate({ inputRange: INPUT, outputRange: OUTPUT });

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? 'Carregando'}
      style={{ alignSelf: 'center', width: SIZE, height: SIZE }}
    >
      <Animated.View style={{ width: SIZE, height: SIZE, transform: [{ rotate }] }}>
        {Array.from({ length: BARS }, (_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: (SIZE - BAR_WIDTH) / 2,
              top: 0,
              width: BAR_WIDTH,
              height: SIZE,
              transform: [{ rotate: `${i * (360 / BARS)}deg` }],
            }}
          >
            <View
              style={{
                width: BAR_WIDTH,
                height: BAR_LENGTH,
                borderRadius: BAR_WIDTH / 2,
                backgroundColor: tint,
                // Leading bar (i = 0) solid, the tail fades behind it (clockwise turn).
                opacity: 1 - (((BARS - i) % BARS) / BARS) * 0.75,
              }}
            />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}
