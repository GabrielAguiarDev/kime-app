import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

import { useAppTheme } from '@theme';

import { Box } from '../Box/Box';
import { Text } from '../Text/Text';

interface CodeFieldProps {
  label: string;
  value: string;
  onChangeText: (digits: string) => void;
  /** Called once when the last digit is filled. */
  onComplete?: (digits: string) => void;
  length: number;
  errorMessage?: string;
  autoFocus?: boolean;
}

/**
 * One-time code as one big cell per digit, following the input spec
 * (DESIGN-SYSTEM.md, 3.8): surface, 2px border, radius-md; the next cell to
 * fill is focused (accent), error turns every cell danger.
 * A single transparent TextInput sits over the cells, so paste and the iOS
 * "From Mail" code suggestion keep working.
 */
export function CodeField({
  label,
  value,
  onChangeText,
  onComplete,
  length,
  errorMessage,
  autoFocus,
}: CodeFieldProps) {
  const theme = useAppTheme();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.split('');
  const activeIndex = Math.min(value.length, length - 1);

  const handleChange = (text: string) => {
    const next = text.replace(/\D/g, '').slice(0, length);
    onChangeText(next);
    if (next.length === length && value.length !== length) onComplete?.(next);
  };

  return (
    <Box gap="s4">
      <Text variant="caption">{label}</Text>
      <Pressable onPress={() => input.current?.focus()} accessible={false}>
        <Box flexDirection="row" gap="s8">
          {Array.from({ length }, (_, index) => {
            const isActive = focused && index === activeIndex;
            return (
              // TODO(motion): caret blink / cell pop when a digit lands.
              <Box
                key={index}
                flex={1}
                height={theme.size.codeCell}
                backgroundColor="surface"
                borderRadius="md"
                borderWidth={theme.border.width}
                borderColor={errorMessage ? 'danger' : isActive ? 'accent' : 'border'}
                alignItems="center"
                justifyContent="center"
              >
                <Text variant="title">{digits[index] ?? ''}</Text>
              </Box>
            );
          })}
        </Box>
        <TextInput
          ref={input}
          value={value}
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          maxLength={length}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          caretHidden
          contextMenuHidden={false}
          accessibilityLabel={label}
          accessibilityHint={`Código de ${length} dígitos`}
          style={styles.hiddenInput}
        />
      </Pressable>
      {errorMessage ? (
        <Text variant="caption" color="danger">
          {errorMessage}
        </Text>
      ) : null}
    </Box>
  );
}

const styles = StyleSheet.create({
  // Covers the cells so taps and long-press (paste) reach the real input.
  hiddenInput: { ...StyleSheet.absoluteFill, opacity: 0, color: 'transparent' },
});
