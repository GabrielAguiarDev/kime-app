import { useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { useAppTheme } from '@theme';

import { Box } from '../Box/Box';
import { Text } from '../Text/Text';

interface TextFieldProps extends TextInputProps {
  label: string;
  errorMessage?: string;
  /** Unit for numeric values (kg, cm, ml): fixed on the right, in text-muted. */
  unit?: string;
}

/**
 * Input (DESIGN-SYSTEM.md, 3.8): height 52, surface, 2px border, radius-md.
 * Visual states: rest (border), focused (accent), error (danger + caption below).
 */
export function TextField({ label, errorMessage, unit, onFocus, onBlur, ...inputProps }: TextFieldProps) {
  const theme = useAppTheme();
  const [focused, setFocused] = useState(false);
  const body = theme.textVariants.body;

  return (
    <Box gap="s4">
      <Text variant="caption">{label}</Text>
      <Box
        backgroundColor="surface"
        borderRadius="md"
        borderWidth={theme.border.width}
        borderColor={errorMessage ? 'danger' : focused ? 'accent' : 'border'}
        paddingHorizontal="s16"
        flexDirection="row"
        alignItems="center"
        gap="s8"
      >
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={theme.colors.textMuted}
          selectionColor={theme.colors.accent}
          style={{
            flex: 1,
            minHeight: theme.size.input - 2 * theme.border.width,
            fontFamily: body.fontFamily,
            fontSize: body.fontSize,
            fontVariant: body.fontVariant,
            color: theme.colors.text,
          }}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...inputProps}
        />
        {unit ? (
          <Text variant="body" color="textMuted">
            {unit}
          </Text>
        ) : null}
      </Box>
      {errorMessage ? (
        <Text variant="caption" color="danger">
          {errorMessage}
        </Text>
      ) : null}
    </Box>
  );
}
