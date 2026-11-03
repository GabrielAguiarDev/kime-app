import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@theme';

import { Box } from '../Box/Box';
import { Text } from '../Text/Text';

interface ScreenProps {
  children: ReactNode;
  title?: string;
  /** Scrollable content (default true). Scroll indicators are always hidden. */
  scrollable?: boolean;
  /** Fixed content under the scroll area (e.g. primary action). */
  footer?: ReactNode;
  /** Set false when the screen sits above the tab bar (bottom inset handled by tabs). */
  bottomInset?: boolean;
}

export function Screen({ children, title, scrollable = true, footer, bottomInset = true }: ScreenProps) {
  const { top, bottom } = useSafeAreaInsets();
  const { spacing } = useAppTheme();
  const paddingBottom = (bottomInset ? bottom : 0) + spacing.s16;

  const header = title ? (
    <Text variant="title" marginBottom="s24" accessibilityRole="header">
      {title}
    </Text>
  ) : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Box flex={1} backgroundColor="background" style={{ paddingTop: top + spacing.s16 }}>
        {scrollable ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: spacing.s20,
              paddingBottom: footer ? spacing.s16 : paddingBottom,
              flexGrow: 1,
            }}
          >
            {header}
            {children}
          </ScrollView>
        ) : (
          <Box flex={1} paddingHorizontal="s20" style={{ paddingBottom: footer ? 0 : paddingBottom }}>
            {header}
            {children}
          </Box>
        )}
        {footer ? (
          <Box paddingHorizontal="s20" style={{ paddingBottom }} gap="s12">
            {footer}
          </Box>
        ) : null}
      </Box>
    </KeyboardAvoidingView>
  );
}
