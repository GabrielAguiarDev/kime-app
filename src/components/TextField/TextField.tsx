import { useEffect, useId, useRef, useSyncExternalStore, type ComponentRef } from 'react';
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

/** Time for iOS to deliver the focus after the touch ends; past it, the touch was a scroll. */
const FOCUS_SETTLE_MS = 250;

type InputRef = ComponentRef<typeof TextInput>;

/**
 * Which field shows the focused (accent) border. One for the whole app, so
 * touching a field lights it AND clears the previous one in the same frame.
 * The native focus/blur events reach JS late (cursor first, border after),
 * and the old field's late blur would leave two borders lit for a moment.
 */
const focusHighlight = {
  activeId: null as string | null,
  inputs: new Map<string, InputRef>(),
  listeners: new Set<() => void>(),
  set(id: string | null) {
    if (this.activeId === id) return;
    this.activeId = id;
    this.listeners.forEach((listener) => listener());
  },
  /** Re-reads the real native focus (after a touch that may have been a scroll). */
  sync() {
    let focusedId: string | null = null;
    this.inputs.forEach((input, id) => {
      if (input.isFocused()) focusedId = id;
    });
    this.set(focusedId);
  },
  subscribe(listener: () => void) {
    focusHighlight.listeners.add(listener);
    return () => {
      focusHighlight.listeners.delete(listener);
    };
  },
};

/**
 * Input (DESIGN-SYSTEM.md, 3.8): height 52, surface, 2px border, radius-md.
 * Visual states: rest (border), focused (accent), error (danger + caption below).
 */

export function TextField({
  label,
  errorMessage,
  unit,
  onFocus,
  onBlur,
  onPressIn,
  onPressOut,
  style,
  ...inputProps
}: TextFieldProps) {
  const theme = useAppTheme();
  const id = useId();
  const input = useRef<InputRef>(null);
  const focused = useSyncExternalStore(focusHighlight.subscribe, () => focusHighlight.activeId === id);

  useEffect(() => {
    const current = input.current;
    if (current) focusHighlight.inputs.set(id, current);
    return () => {
      focusHighlight.inputs.delete(id);
      if (focusHighlight.activeId === id) focusHighlight.set(null);
    };
  }, [id]);
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
          ref={input}
          accessibilityLabel={label}
          placeholderTextColor={theme.colors.textMuted}
          selectionColor={theme.colors.accent}
          style={[
            {
              flex: 1,
              minHeight: theme.size.input - 2 * theme.border.width,
              fontFamily: body.fontFamily,
              fontSize: body.fontSize,
              fontVariant: body.fontVariant,
              color: theme.colors.text,
            },
            // Extra layout (e.g. a taller multiline field) on top of the base text style.
            style,
          ]}
          // Touch-down moves the highlight here at once (and off the previous field).
          onPressIn={(e) => {
            focusHighlight.set(id);
            onPressIn?.(e);
          }}
          onPressOut={(e) => {
            // If the touch was a scroll and never focused, follow the real focus.
            setTimeout(() => {
              if (!input.current?.isFocused()) focusHighlight.sync();
            }, FOCUS_SETTLE_MS);
            onPressOut?.(e);
          }}
          // Focus without a touch (keyboard "next", autoFocus).
          onFocus={(e) => {
            focusHighlight.set(id);
            onFocus?.(e);
          }}
          // A late blur from the previous field must not clear the new one.
          onBlur={(e) => {
            if (focusHighlight.activeId === id) focusHighlight.set(null);
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
