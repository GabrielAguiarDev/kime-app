import { Pressable, ScrollView } from 'react-native';

import { useAppTheme } from '@theme';

import { Box } from '../Box/Box';
import { Text } from '../Text/Text';

export interface FilterChip {
  key: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}

/**
 * Compact filters in one row that scrolls sideways (lists: Equipe…). Smaller
 * than the selection cards: 32 tall, caption text, radius sm (never a pill);
 * the touch area still reaches 44 (hitSlop). Selected: accent border + accent
 * at 8%, like a selected card. No scroll bars.
 */
export function FilterChips({ chips, accessibilityLabel }: { chips: FilterChip[]; accessibilityLabel: string }) {
  const { spacing, size, border } = useAppTheme();
  const slop = (size.touchTarget - size.filterChip) / 2;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={accessibilityLabel}
      style={{ marginHorizontal: -spacing.screenMargin }}
      contentContainerStyle={{ paddingHorizontal: spacing.screenMargin, gap: spacing.s8, paddingVertical: slop }}
    >
      {chips.map((chip) => (
        <Pressable
          key={chip.key}
          onPress={chip.onPress}
          hitSlop={{ top: slop, bottom: slop }}
          accessibilityRole="button"
          accessibilityState={{ selected: chip.selected }}
          accessibilityLabel={chip.label}
        >
          <Box
            height={size.filterChip}
            paddingHorizontal="s12"
            justifyContent="center"
            borderRadius="sm"
            borderWidth={border.width}
            borderColor={chip.selected ? 'accent' : 'border'}
            backgroundColor={chip.selected ? 'accentSelected' : 'surface'}
          >
            <Text variant="caption" color={chip.selected ? 'accent' : 'text'}>
              {chip.label}
            </Text>
          </Box>
        </Pressable>
      ))}
    </ScrollView>
  );
}
