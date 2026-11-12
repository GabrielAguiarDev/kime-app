import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
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
const MAX_SCALE = 4;
/** Vertical drag (not zoomed) that closes the photo, or a fast flick. */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;
const SPRING = { damping: 22, stiffness: 260 };

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

/**
 * Full-screen photo opened from a thumbnail, shared-element style: the photo grows from the
 * thumbnail's place (a circle) to the screen width (square corners) while the backdrop
 * darkens. Like WhatsApp: pinch to zoom (then drag to look around), drag up or down to
 * close; a tap (or back) closes too. Closing shrinks it back into the thumbnail.
 * Reduced motion: no animation.
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
  const duration = reduceMotion ? 0 : DURATION;

  const progress = useSharedValue(0);
  // Zoom and the position while zoomed.
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const savedPanX = useSharedValue(0);
  const savedPanY = useSharedValue(0);
  // Drag to close (only at scale 1).
  const dragY = useSharedValue(0);

  const size = width;

  useEffect(() => {
    if (!origin) return;
    scale.set(1);
    savedScale.set(1);
    panX.set(0);
    panY.set(0);
    dragY.set(0);
    progress.set(withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
  }, [origin, duration, progress, scale, savedScale, panX, panY, dragY]);

  const finishClose = () => onClose();

  const close = () => {
    'worklet';
    const timing = { duration, easing: Easing.in(Easing.cubic) };
    scale.set(withTiming(1, timing));
    panX.set(withTiming(0, timing));
    panY.set(withTiming(0, timing));
    dragY.set(withTiming(0, timing));
    progress.set(
      withTiming(0, timing, (done) => {
        if (done) scheduleOnRN(finishClose);
      }),
    );
  };

  /** Keeps the zoomed photo covering the screen width (and height when it is taller). */
  const limits = (s: number) => {
    'worklet';
    return { x: (size * s - size) / 2, y: Math.max(0, (size * s - height) / 2) };
  };

  const pinch = usePinchGesture({
    onUpdate: (e) => {
      'worklet';
      scale.set(clamp(savedScale.get() * e.scale, 1, MAX_SCALE));
      const { x, y } = limits(scale.get());
      panX.set(clamp(panX.get(), -x, x));
      panY.set(clamp(panY.get(), -y, y));
    },
    onDeactivate: () => {
      'worklet';
      // A pinch that ends almost at the start goes back to the whole photo.
      if (scale.get() < 1.05) {
        scale.set(withSpring(1, SPRING));
        panX.set(withSpring(0, SPRING));
        panY.set(withSpring(0, SPRING));
        savedScale.set(1);
      } else {
        savedScale.set(scale.get());
      }
    },
  });

  const pan = usePanGesture({
    maxPointers: 2,
    onActivate: () => {
      'worklet';
      savedPanX.set(panX.get());
      savedPanY.set(panY.get());
    },
    onUpdate: (e) => {
      'worklet';
      if (savedScale.get() > 1 || scale.get() > 1) {
        const { x, y } = limits(scale.get());
        panX.set(clamp(savedPanX.get() + e.translationX, -x, x));
        panY.set(clamp(savedPanY.get() + e.translationY, -y, y));
      } else {
        dragY.set(e.translationY);
      }
    },
    onDeactivate: (e) => {
      'worklet';
      if (savedScale.get() > 1 || scale.get() > 1) return;
      if (Math.abs(e.translationY) > DISMISS_DISTANCE || Math.abs(e.velocityY) > DISMISS_VELOCITY) {
        close();
      } else {
        dragY.set(withSpring(0, SPRING));
      }
    },
  });

  const tap = useTapGesture({
    onActivate: () => {
      'worklet';
      close();
    },
  });

  const gesture = useSimultaneousGestures(pinch, pan, tap);

  const from = origin ?? { x: width / 2, y: height / 2, width: 0, height: 0 };
  const to = { x: 0, y: (height - size) / 2 };

  const photoStyle = useAnimatedStyle(() => ({
    left: interpolate(progress.get(), [0, 1], [from.x, to.x]),
    top: interpolate(progress.get(), [0, 1], [from.y, to.y]),
    width: interpolate(progress.get(), [0, 1], [from.width, size]),
    height: interpolate(progress.get(), [0, 1], [from.height, size]),
    borderRadius: interpolate(progress.get(), [0, 1], [from.width / 2, 0]),
    transform: [{ translateX: panX.get() }, { translateY: panY.get() + dragY.get() }, { scale: scale.get() }],
  }));
  // The backdrop lightens as the photo is dragged away.
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.get() * interpolate(Math.abs(dragY.get()), [0, height / 2], [1, 0.3], 'clamp'),
  }));

  return (
    <Modal
      visible={!!origin}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={() => close()}
    >
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <GestureDetector gesture={gesture}>
          <View
            style={StyleSheet.absoluteFill}
            accessible
            accessibilityRole="image"
            accessibilityLabel={accessibilityLabel}
            accessibilityHint="Toque duas vezes para fechar."
            onAccessibilityTap={() => close()}
            onAccessibilityEscape={() => close()}
          >
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.bg }, backdropStyle]} />
            <Animated.View style={[styles.photo, photoStyle]}>
              <Image source={{ uri, cacheKey }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
            </Animated.View>
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  photo: { position: 'absolute', overflow: 'hidden' },
});
