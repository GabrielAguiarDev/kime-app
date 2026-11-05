import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Pressable, ScrollView, useWindowDimensions } from 'react-native';

import { Box, Icon, Text, type IconName } from '@components';
import { useAppTheme } from '@theme';

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * BottomSheet does not avoid the keyboard: forms with a TextField add this
 * spacer so the field and the action stay above it.
 */
function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => setHeight(e.endCoordinates.height));
    const showAndroid = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setHeight(0));
    const hideAndroid = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      showAndroid.remove();
      hide.remove();
      hideAndroid.remove();
    };
  }, []);
  return height;
}

export interface SheetHeaderAction {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  /** `danger` for destructive actions (delete). */
  color?: 'danger' | 'accent';
}

/**
 * Content of a form sheet: title (with an optional icon action on the right,
 * e.g. delete), scrollable body (no scroll bars) and fixed actions.
 */
export function SheetForm({
  title,
  children,
  actions,
  headerAction,
  tall = false,
}: {
  title: string;
  children: ReactNode;
  /** Fixed at the bottom; omit for pick-and-close lists (tap outside / drag down closes). */
  actions?: ReactNode;
  headerAction?: SheetHeaderAction;
  /** Long forms: the body scrolls in a taller area; the actions stay fixed at the bottom. */
  tall?: boolean;
}) {
  const { height } = useWindowDimensions();
  const { size, spacing } = useAppTheme();
  const keyboard = useKeyboardHeight();
  return (
    <Box gap="s16" style={{ paddingBottom: keyboard }}>
      <Box flexDirection="row" alignItems="center" gap="s12">
        <Text variant="heading" accessibilityRole="header" flex={1}>
          {title}
        </Text>
        {headerAction ? (
          <Pressable
            onPress={headerAction.onPress}
            accessibilityRole="button"
            accessibilityLabel={headerAction.accessibilityLabel}
            hitSlop={spacing.s8}
            style={{
              width: size.touchTarget,
              height: size.touchTarget,
              alignItems: 'flex-end',
              justifyContent: 'center',
              // Visually aligned with the title line; the touch area stays 44×44.
              marginVertical: -spacing.s12,
            }}
          >
            <Icon name={headerAction.icon} color={headerAction.color ?? 'accent'} />
          </Pressable>
        ) : null}
      </Box>
      <ScrollView
        style={{ maxHeight: (height - keyboard) * (tall ? 0.7 : 0.55) }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Box gap="s16">{children}</Box>
      </ScrollView>
      {actions ? <Box gap="s12">{actions}</Box> : null}
    </Box>
  );
}
