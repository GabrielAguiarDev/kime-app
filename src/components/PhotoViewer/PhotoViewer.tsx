import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useAppTheme } from '@theme';

/** Where the photo starts (window coordinates of the thumbnail). */
export interface PhotoOrigin {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DURATION = 280;

/**
 * Full-screen photo opened from a thumbnail, shared-element style: the photo grows from the
 * thumbnail's place (a circle) to the screen width (square corners) while the backdrop
 * darkens; a tap (or back) shrinks it back into the thumbnail. Reduced motion: no animation.
 */
export function PhotoViewer({
  uri,
  cacheKey,
  origin,
  accessibilityLabel,
  onClose,
}: {
  uri: string;
  cacheKey?: string;
  /** null = closed. */
  origin: PhotoOrigin | null;
  accessibilityLabel: string;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const duration = reduceMotion ? 0 : DURATION;

  useEffect(() => {
    if (origin) progress.set(withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
  }, [origin, duration, progress]);

  const close = () => {
    progress.set(
      withTiming(0, { duration, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) scheduleOnRN(onClose);
      }),
    );
  };

  const from = origin ?? { x: width / 2, y: height / 2, width: 0, height: 0 };
  const size = width;
  const to = { x: 0, y: (height - size) / 2 };

  const photoStyle = useAnimatedStyle(() => ({
    left: interpolate(progress.get(), [0, 1], [from.x, to.x]),
    top: interpolate(progress.get(), [0, 1], [from.y, to.y]),
    width: interpolate(progress.get(), [0, 1], [from.width, size]),
    height: interpolate(progress.get(), [0, 1], [from.height, size]),
    borderRadius: interpolate(progress.get(), [0, 1], [from.width / 2, 0]),
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));

  return (
    <Modal visible={!!origin} transparent statusBarTranslucent animationType="none" onRequestClose={close}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Fechar foto">
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.bg }, backdropStyle]} />
        <Animated.View style={[styles.photo, photoStyle]} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
          <Image source={{ uri, cacheKey }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  photo: { position: 'absolute', overflow: 'hidden' },
});
