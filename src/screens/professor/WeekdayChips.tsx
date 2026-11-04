import { Box, Text } from '@components';
import { WEEK_ORDER, WEEKDAY_LABELS, type Weekday } from '@domain/Classes';
import { useAppTheme } from '@theme';

/**
 * The seven weekdays in a row, the ones with class highlighted (accent at 8%
 * + accent border, like a selected card). Read-only, compact.
 */
export function WeekdayChips({ days, muted = false }: { days: Weekday[]; muted?: boolean }) {
  const theme = useAppTheme();
  return (
    <Box flexDirection="row" gap="s4">
      {WEEK_ORDER.map((day) => {
        const on = days.includes(day);
        return (
          <Box
            key={day}
            flex={1}
            alignItems="center"
            paddingVertical="s4"
            borderRadius="sm"
            borderWidth={theme.border.width}
            borderColor={on && !muted ? 'accent' : 'border'}
            backgroundColor={on && !muted ? 'accentSelected' : undefined}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text variant="caption" color={on ? (muted ? 'text' : 'accent') : 'textMuted'}>
              {WEEKDAY_LABELS[day].short}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
