import type { ComponentRef, Ref } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { BeltSwatch, Icon } from '@components';
import type { BeltLook } from '@domain/Classes';
import { useAppTheme } from '@theme';

export type JourneyNodeState = 'done' | 'current' | 'locked';

/** Node sizes: done / locked, current. */
export const NODE_SIZE = 80;
export const NODE_SIZE_CURRENT = 96;
const RING = 6;
/** Soft glow behind the current node (diameter beyond the node). */
export const NODE_GLOW = 44;

interface JourneyNodeProps {
  ref?: Ref<ComponentRef<typeof View>>;
  state: JourneyNodeState;
  /** Current: classes done in the belt over the goal (0..1). */
  progress?: number;
  /** Current: the belt shown in the center. */
  belt?: BeltLook | null;
  onPress: () => void;
  accessibilityLabel: string;
}

/**
 * Dark circular node of a section. Done: success ring and check. Current:
 * larger, accent progress ring and the belt in the center (the glow behind
 * it is drawn by the section, under the banner). Locked: text-muted ring and padlock.
 */
export function JourneyNode({ ref, state, progress = 0, belt, onPress, accessibilityLabel }: JourneyNodeProps) {
  const { colors } = useAppTheme();
  const size = state === 'current' ? NODE_SIZE_CURRENT : NODE_SIZE;
  const r = (size - RING) / 2;
  const circumference = 2 * Math.PI * r;
  const ringColor = state === 'done' ? colors.success : state === 'locked' ? colors.textMuted : colors.border;

  return (
    <View ref={ref} collapsable={false} style={{ width: size, height: size }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={ringColor} strokeWidth={RING} fill="none" />
          {state === 'current' && progress > 0 ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={colors.accent}
              strokeWidth={RING}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circumference * Math.min(1, progress)} ${circumference}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ) : null}
        </Svg>
        {state === 'done' ? (
          <Icon name="done" color="success" size={32} />
        ) : state === 'locked' ? (
          <Icon name="locked" color="textMuted" size={28} />
        ) : belt ? (
          <BeltSwatch belt={belt} width={44} height={16} />
        ) : (
          <Icon name="belt" color="accent" size={32} />
        )}
      </Pressable>
    </View>
  );
}
