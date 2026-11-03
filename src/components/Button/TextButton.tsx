import { Pressable, type PressableProps } from 'react-native';

import type { ColorToken } from '@theme';

import { Text } from '../Text/Text';

interface TextButtonProps extends Omit<PressableProps, 'children'> {
  title: string;
  color?: ColorToken;
}

/**
 * Low-emphasis action (links, "Sair"). Visual states: rest, pressed (dimmed),
 * disabled (muted color).
 */
export function TextButton({ title, color = 'primary', disabled, ...props }: TextButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={8}
      disabled={disabled}
      {...props}
    >
      {({ pressed }) => (
        <Text
          variant="bodyBold"
          color={disabled ? 'borderStrong' : color}
          opacity={pressed ? 0.6 : 1}
          textAlign="center"
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}
