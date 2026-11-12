import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@theme';
import { clampValue, cropRectFor } from '@utils/cropRect';
import { cropSquareImage, imagePixelSize } from '@utils/squareImage';

import { Box } from '../Box/Box';
import { Button } from '../Button/Button';
import { Text } from '../Text/Text';

export type CropShape = 'circle' | 'square';

const MAX_ZOOM = 5;
const SPRING = { damping: 22, stiffness: 260 };

const clamp = clampValue;

/**
 * Crop screen after picking a photo (WhatsApp style): the photo under a
 * round (profile) or square (logo) frame; pinch to zoom and drag to place it,
 * always covering the frame. "Usar foto" hands back a local square JPEG.
 * `source` null = closed.
 */
export function PhotoCropper({
  source,
  shape,
  mirrored = false,
  onCancel,
  onDone,
}: {
  source: string | null;
  shape: CropShape;
  /** Show the photo flipped (iOS front camera; the upload flips it back). */
  mirrored?: boolean;
  onCancel: () => void;
  onDone: (uri: string) => void;
}) {
  return (
    <Modal visible={!!source} transparent={false} animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.fill}>
          {source ? <Cropper key={source} uri={source} shape={shape} mirrored={mirrored} onCancel={onCancel} onDone={onDone} /> : null}
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </Modal>
  );
}

function Cropper({
  uri,
  shape,
  mirrored,
  onCancel,
  onDone,
}: {
  uri: string;
  shape: CropShape;
  mirrored: boolean;
  onCancel: () => void;
  onDone: (uri: string) => void;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const frame = width - theme.spacing.s24 * 2;
  const zoom = useSharedValue(1);
  const savedZoom = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  useEffect(() => {
    let alive = true;
    imagePixelSize(uri).then(
      (s) => alive && setSize(s),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [uri]);

  // Image drawn to cover the frame at zoom 1.
  const base = size ? Math.max(frame / size.width, frame / size.height) : 1;
  const drawnW = size ? size.width * base : frame;
  const drawnH = size ? size.height * base : frame;

  /** How far the image may move and still cover the frame. */
  const limits = (z: number) => {
    'worklet';
    return { x: Math.max(0, (drawnW * z - frame) / 2), y: Math.max(0, (drawnH * z - frame) / 2) };
  };

  const pinch = usePinchGesture({
    onUpdate: (e) => {
      'worklet';
      zoom.set(clamp(savedZoom.get() * e.scale, 1, MAX_ZOOM));
      const { x, y } = limits(zoom.get());
      tx.set(clamp(tx.get(), -x, x));
      ty.set(clamp(ty.get(), -y, y));
    },
    onDeactivate: () => {
      'worklet';
      savedZoom.set(zoom.get());
    },
  });

  const pan = usePanGesture({
    maxPointers: 2,
    onActivate: () => {
      'worklet';
      savedX.set(tx.get());
      savedY.set(ty.get());
    },
    onUpdate: (e) => {
      'worklet';
      const { x, y } = limits(zoom.get());
      // A little give past the edge; it springs back on release.
      const nextX = savedX.get() + e.translationX;
      const nextY = savedY.get() + e.translationY;
      tx.set(Math.abs(nextX) > x ? Math.sign(nextX) * (x + (Math.abs(nextX) - x) / 4) : nextX);
      ty.set(Math.abs(nextY) > y ? Math.sign(nextY) * (y + (Math.abs(nextY) - y) / 4) : nextY);
    },
    onDeactivate: () => {
      'worklet';
      const { x, y } = limits(zoom.get());
      tx.set(withSpring(clamp(tx.get(), -x, x), SPRING));
      ty.set(withSpring(clamp(ty.get(), -y, y), SPRING));
    },
  });

  const gesture = useSimultaneousGestures(pinch, pan);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.get() },
      { translateY: ty.get() },
      { scale: zoom.get() },
      { scaleX: mirrored ? -1 : 1 },
    ],
  }));

  const confirm = async () => {
    if (!size || saving) return;
    setSaving(true);
    try {
      const { x, y } = limits(zoom.get());
      const rect = cropRectFor(size, frame, zoom.get(), clamp(tx.get(), -x, x), clamp(ty.get(), -y, y), mirrored);
      onDone(await cropSquareImage(uri, rect));
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  // Mask: one view whose huge border darkens everything around the hole (the frame).
  const outside = Math.max(width, height);
  const holeRadius = shape === 'circle' ? frame / 2 : theme.borderRadii.lg;

  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.bg }]}>
      <GestureDetector gesture={gesture}>
        <View style={styles.fill} accessible accessibilityLabel="Foto. Arraste para posicionar e use dois dedos para aproximar.">
          {size ? (
            <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
              <Animated.View style={[{ width: drawnW, height: drawnH }, imageStyle]}>
                <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
              </Animated.View>
            </View>
          ) : null}
          <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
            <View
              style={{
                width: frame + outside * 2,
                height: frame + outside * 2,
                borderWidth: outside,
                borderRadius: holeRadius + outside,
                borderColor: theme.colors.scrim,
              }}
            />
          </View>
        </View>
      </GestureDetector>

      <View style={[styles.top, { paddingTop: insets.top + theme.spacing.s16 }]} pointerEvents="none">
        <Text variant="bodyStrong" textAlign="center">
          Mover e ajustar
        </Text>
      </View>

      {!size && !failed ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <ActivityIndicator accessibilityLabel="Carregando foto" />
        </View>
      ) : null}

      <View style={[styles.bottom, { paddingBottom: insets.bottom + theme.spacing.s16, paddingHorizontal: theme.spacing.s24 }]}>
        {failed ? (
          <Text variant="caption" color="danger" textAlign="center">
            Não foi possível usar esta foto. Tente outra.
          </Text>
        ) : null}
        <Box flexDirection="row" gap="s12">
          <Box flex={1}>
            <Button title="Cancelar" variant="secondary" disabled={saving} onPress={onCancel} />
          </Box>
          <Box flex={1}>
            <Button title="Usar foto" disabled={!size || failed} loading={saving} onPress={() => void confirm()} />
          </Box>
        </Box>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, gap: 12 },
});
