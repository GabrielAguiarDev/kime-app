import { useEffect, useRef, type ComponentRef } from 'react';
import { ScrollView, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

import { Box } from '../Box/Box';
import { Text } from '../Text/Text';
import { WHEEL_VISIBLE_ROWS, type WheelPickerProps } from './types';

/**
 * Wheel picker (like the system date wheel, one column): the rows snap to
 * the middle band, which holds the selection. Android and builds without the
 * native module; iOS uses the SwiftUI wheel (WheelPicker.ios.tsx).
 */
export function JsWheelPicker<T extends string | number>({ options, value, onChange, accessibilityLabel }: WheelPickerProps<T>) {
  const { size, border } = useAppTheme();
  const row = size.touchTarget;
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const pad = row * Math.floor(WHEEL_VISIBLE_ROWS / 2);

  // Follow outside changes (and place the initial value) without animating.
  useEffect(() => {
    scroll.current?.scrollTo({ y: index * row, animated: false });
  }, [index, row]);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.min(options.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / row)));
    const option = options[next];
    if (option && option.value !== value) {
      void haptics.tap();
      onChange(option.value);
    }
  };

  const step = (delta: number) => {
    const option = options[index + delta];
    if (option) onChange(option.value);
  };

  return (
    <Box
      height={row * WHEEL_VISIBLE_ROWS}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: options[index]?.label }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      {/* Selection band behind the middle row. */}
      <Box
        position="absolute"
        left={0}
        right={0}
        top={pad}
        height={row}
        borderRadius="md"
        backgroundColor="surfaceRaised"
        borderColor="border"
        borderWidth={border.width}
      />
      <ScrollView
        ref={scroll}
        nestedScrollEnabled
        snapToInterval={row}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: pad }}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={(e) => {
          // A drag that stops without momentum still has to settle.
          if (!e.nativeEvent.velocity || Math.abs(e.nativeEvent.velocity.y) < 0.05) settle(e);
        }}
      >
        {options.map((o, i) => (
          <Box key={String(o.value)} height={row} alignItems="center" justifyContent="center">
            <Text variant={i === index ? 'heading' : 'body'} color={i === index ? 'text' : 'textMuted'}>
              {o.label}
            </Text>
          </Box>
        ))}
      </ScrollView>
    </Box>
  );
}
