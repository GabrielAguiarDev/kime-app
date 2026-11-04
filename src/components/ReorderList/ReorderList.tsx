import { useEffect, type ReactNode } from 'react';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

import { Box } from '../Box/Box';
import { Icon } from '../Icon/Icon';

interface ReorderListProps<T> {
  items: T[];
  keyOf: (item: T) => string;
  /** Accessible name of a row ("Faixa azul"). */
  labelOf: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** New order after a move. */
  onChange: (items: T[]) => void;
}

const LONG_PRESS_MS = 250;

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/**
 * Hold a row and drag it to reorder. The dragged row follows the finger
 * (direct manipulation); the others jump to their new place without any
 * animation (rule: no animations, see TODO(motion)). Rows have a fixed height
 * (`size.reorderRow`). Screen readers get "Mover para cima / para baixo"
 * actions instead of the drag.
 */
export function ReorderList<T>({ items, keyOf, labelOf, renderItem, onChange }: ReorderListProps<T>) {
  const { size, spacing } = useAppTheme();
  const step = size.reorderRow + spacing.s8;

  const move = (key: string, to: number) => {
    const from = items.findIndex((i) => keyOf(i) === key);
    if (from < 0 || from === to) return;
    onChange(moveItem(items, from, to));
  };

  return (
    <Box gap="s8">
      {items.map((item, index) => {
        const key = keyOf(item);
        return (
          <DraggableRow
            key={key}
            index={index}
            count={items.length}
            step={step}
            label={labelOf(item)}
            onMove={(to) => move(key, to)}
          >
            {renderItem(item)}
          </DraggableRow>
        );
      })}
    </Box>
  );
}

function DraggableRow({
  index,
  count,
  step,
  label,
  onMove,
  children,
}: {
  index: number;
  count: number;
  step: number;
  label: string;
  onMove: (to: number) => void;
  children: ReactNode;
}) {
  const { size, border } = useAppTheme();
  const active = useSharedValue(false);
  const drag = useSharedValue(0);
  const startIndex = useSharedValue(index);
  // Index as React last rendered it (the row moves in the layout when the order changes).
  const currentIndex = useSharedValue(index);

  useEffect(() => {
    currentIndex.set(index);
  }, [index, currentIndex]);

  const pan = usePanGesture({
    activateAfterLongPress: LONG_PRESS_MS,
    onActivate: () => {
      'worklet';
      active.set(true);
      drag.set(0);
      startIndex.set(currentIndex.get());
      scheduleOnRN(haptics.tap);
    },
    onUpdate: (e) => {
      'worklet';
      drag.set(e.translationY);
      const target = Math.max(0, Math.min(count - 1, Math.round(startIndex.get() + e.translationY / step)));
      if (target !== currentIndex.get()) scheduleOnRN(onMove, target);
    },
    onFinalize: () => {
      'worklet';
      active.set(false);
      drag.set(0);
    },
  });

  // The layout already moved the row by (current - start) steps: compensate so it stays under the finger.
  const style = useAnimatedStyle(() => ({
    zIndex: active.get() ? 1 : 0,
    transform: [{ translateY: active.get() ? drag.get() - (currentIndex.get() - startIndex.get()) * step : 0 }],
  }));
  // TODO(motion): lift on pick-up and settle on drop.

  const activeBorder = useAnimatedStyle(() => ({ opacity: active.get() ? 1 : 0 }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={style}
        accessible
        accessibilityLabel={label}
        accessibilityHint="Toque duas vezes e segure para arrastar, ou use as ações para mover."
        accessibilityActions={[
          { name: 'moveUp', label: 'Mover para cima' },
          { name: 'moveDown', label: 'Mover para baixo' },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'moveUp' && index > 0) onMove(index - 1);
          if (e.nativeEvent.actionName === 'moveDown' && index < count - 1) onMove(index + 1);
        }}
      >
        <Box
          height={size.reorderRow}
          flexDirection="row"
          alignItems="center"
          gap="s12"
          paddingHorizontal="s16"
          borderRadius="lg"
          borderWidth={border.width}
          borderColor="border"
          backgroundColor="surface"
        >
          <Box flex={1} flexDirection="row" alignItems="center" gap="s12">
            {children}
          </Box>
          <Icon name="dragHandle" color="textMuted" />
          {/* Picked-up state: accent outline over the row. */}
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: -border.width,
                bottom: -border.width,
                left: -border.width,
                right: -border.width,
              },
              activeBorder,
            ]}
          >
            <Box flex={1} borderRadius="lg" borderWidth={border.width} borderColor="accent" />
          </Animated.View>
        </Box>
      </Animated.View>
    </GestureDetector>
  );
}
