import { Pressable, StyleSheet, View } from 'react-native';

import { Box, Text } from '@components';
import { useAppTheme } from '@theme';

import type { NodeCopy } from './trailCopy';

export interface PopoverAnchor {
  /** Stop frame relative to the trail container. */
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TrailPopoverProps {
  anchor: PopoverAnchor;
  container: { width: number; height: number };
  copy: NodeCopy;
  onClose: () => void;
}

const MAX_WIDTH = 280;
const ARROW = 14;

/**
 * Small popover anchored to a node: title, status and a short text. Below the
 * stop, or above it in the lower half of the screen. Closes on any touch
 * outside it.
 */
export function TrailPopover({ anchor, container, copy, onClose }: TrailPopoverProps) {
  const { spacing, colors, border, borderRadii } = useAppTheme();
  const width = Math.min(MAX_WIDTH, container.width - spacing.screenMargin * 2);
  const centerX = anchor.x + anchor.width / 2;
  const left = Math.max(spacing.screenMargin, Math.min(centerX - width / 2, container.width - spacing.screenMargin - width));
  const above = anchor.y + anchor.height / 2 > container.height * 0.55;
  const gap = spacing.s12;
  const arrowLeft = Math.max(borderRadii.lg, Math.min(centerX - left - ARROW / 2, width - borderRadii.lg - ARROW));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" />
      {/* TODO(motion): popover opening from the stop (scale + fade) and closing. */}
      <View
        accessibilityViewIsModal
        style={{
          position: 'absolute',
          left,
          width,
          ...(above ? { bottom: container.height - anchor.y + gap } : { top: anchor.y + anchor.height + gap }),
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: arrowLeft,
            width: ARROW,
            height: ARROW,
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.border,
            borderWidth: border.width,
            transform: [{ rotate: '45deg' }],
            ...(above ? { bottom: -ARROW / 2 } : { top: -ARROW / 2 }),
          }}
        />
        <Box
          backgroundColor="surfaceRaised"
          borderColor="border"
          borderWidth={border.width}
          borderRadius="lg"
          padding="s16"
          gap="s4"
        >
          <Text variant="bodyStrong">{copy.title}</Text>
          <Text variant="caption" color="accent">
            {copy.status}
          </Text>
          <Text variant="body" marginTop="s4">
            {copy.text}
          </Text>
        </Box>
      </View>
    </View>
  );
}
