import { useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { fontFamily, useAppTheme } from '@theme';

import { Box } from '../Box/Box';
import { Text } from '../Text/Text';

interface TextFieldProps extends TextInputProps {
  label: string;
  errorMessage?: string;
}

export function TextField({ label, errorMessage, onFocus, onBlur, ...inputProps }: TextFieldProps) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);

  return (
    <Box gap="s4">
      <Text variant="label">{label}</Text>
      <Box
        backgroundColor="surface"
        borderRadius="m"
        borderWidth={2}
        borderColor={errorMessage ? 'danger' : focused ? 'text' : 'border'}
        paddingHorizontal="s16"
      >
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          style={{
            minHeight: 52,
            fontFamily: fontFamily.medium,
            fontSize: 16,
            color: colors.text,
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
      </Box>
      {errorMessage ? (
        <Text variant="caption" color="danger">
          {errorMessage}
        </Text>
      ) : null}
    </Box>
  );
}
