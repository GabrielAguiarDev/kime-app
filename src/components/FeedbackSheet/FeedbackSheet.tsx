import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, type ColorToken } from '@theme';

import { Box } from '../Box/Box';
import { Button, type ButtonVariant } from '../Button/Button';
import { Icon, type IconName } from '../Icon/Icon';
import { Mascot } from '../Mascot/Mascot';
import { Text } from '../Text/Text';

export type FeedbackTone = 'success' | 'accent' | 'water' | 'warning' | 'danger';

const TONES: Record<FeedbackTone, { tint: ColorToken; line: ColorToken; button: ButtonVariant }> = {
  success: { tint: 'feedbackSuccess', line: 'success', button: 'primary' },
  accent: { tint: 'feedbackAccent', line: 'accent', button: 'primary' },
  water: { tint: 'feedbackWater', line: 'water', button: 'water' },
  warning: { tint: 'feedbackWarning', line: 'warning', button: 'primary' },
  danger: { tint: 'feedbackDanger', line: 'danger', button: 'danger' },
};

interface FeedbackSheetProps {
  tone: FeedbackTone;
  title: string;
  message?: string;
  actionLabel: string;
  onAction: () => void;
  /** Icon on the left. When omitted, the celebrating mascot (56) is shown instead. */
  icon?: IconName;
  /** Replaces the default mascot (e.g. an animated `KimiMascot` size "feedback"). Ignored with `icon`. */
  mascot?: ReactNode;
}

/**
 * Feedback sheet (DESIGN-SYSTEM.md, 3.10) — the "Correto!" strip at the bottom of the screen.
 * Semantic color at 15% over the screen background, 2px top line in the full color.
 * Pass it to `<Screen feedback={...} />`. The caller fires the haptic for the moment.
 */
export function FeedbackSheet({ tone, title, message, actionLabel, onAction, icon, mascot }: FeedbackSheetProps) {
  const { bottom } = useSafeAreaInsets();
  const theme = useAppTheme();
  const t = TONES[tone];

  // iOS ignores accessibilityLiveRegion: announce the sheet explicitly.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message ? `${title}. ${message}` : title);
  }, [title, message]);

  return (
    // TODO(motion): feedback sheet entering from the bottom and leaving.
    <Box backgroundColor="bg" accessibilityLiveRegion="polite">
      <Box
        backgroundColor={t.tint}
        borderTopWidth={theme.border.width}
        borderColor={t.line}
        paddingHorizontal="screenMargin"
        paddingTop="s16"
        gap="s16"
        style={{ paddingBottom: bottom + theme.spacing.s16 }}
      >
        <Box flexDirection="row" alignItems="center" gap="s12">
          {icon ? <Icon name={icon} color={t.line} active /> : (mascot ?? <Mascot size="feedback" expression="celebrating" />)}
          <Box flex={1} gap="s4">
            <Text variant="heading" accessibilityRole="header">
              {title}
            </Text>
            {message ? <Text variant="body">{message}</Text> : null}
          </Box>
        </Box>
        <Button title={actionLabel} variant={t.button} onPress={onAction} />
      </Box>
    </Box>
  );
}
