import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@theme';

import { Box } from '../Box/Box';
import { Text } from '../Text/Text';

interface ScreenProps {
  children: ReactNode;
  title?: string;
  /** Scrollable content (default true). Scroll indicators are always hidden (3.12). */
  scrollable?: boolean;
  /** Fixed content under the scroll area (e.g. primary action). */
  footer?: ReactNode;
  /** Full-width feedback sheet at the bottom (3.10). Replaces `footer` and handles the bottom inset. */
  feedback?: ReactNode;
  /** Set false when the screen sits above the tab bar (bottom inset handled by tabs). */
  bottomInset?: boolean;
}

export function Screen({
  children,
  title,
  scrollable = true,
  footer,
  feedback,
  bottomInset = true,
}: ScreenProps) {
  const { top, bottom } = useSafeAreaInsets();
  const { spacing } = useAppTheme();
  const paddingBottom = (bottomInset ? bottom : 0) + spacing.s16;
  const hasBottom = !!footer || !!feedback;

  const header = title ? (
    <Text variant="title" marginBottom="s24" accessibilityRole="header">
      {title}
    </Text>
  ) : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Box flex={1} backgroundColor="bg" style={{ paddingTop: top + spacing.s16 }}>
        {scrollable ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: spacing.screenMargin,
              paddingBottom: hasBottom ? spacing.s16 : paddingBottom,
              flexGrow: 1,
            }}
          >
            {header}
            {children}
          </ScrollView>
        ) : (
          <Box
            flex={1}
            paddingHorizontal="screenMargin"
            style={{ paddingBottom: hasBottom ? 0 : paddingBottom }}
          >
            {header}
            {children}
          </Box>
        )}
        {feedback ??
          (footer ? (
            <Box paddingHorizontal="screenMargin" style={{ paddingBottom }} gap="s12">
              {footer}
            </Box>
          ) : null)}
      </Box>
    </KeyboardAvoidingView>
  );
}
