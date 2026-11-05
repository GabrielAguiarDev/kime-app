import { Pressable } from 'react-native';

import { useAppTheme } from '@theme';

import { Box } from '../Box/Box';
import { Icon, type IconName } from '../Icon/Icon';
import { Text } from '../Text/Text';

export interface FilterChip {
  key: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Trailing icon, e.g. `chevronDown` for a chip that opens a list. */
  icon?: IconName;
  accessibilityLabel?: string;
}

/**
 * Compact filters (lists: Equipe…): 32 tall, caption text, radius sm (never a
 * pill); the touch area still reaches 44 (hitSlop). They wrap to a new line
 * instead of scrolling sideways — keep them few; long option lists go in a
 * sheet behind a chip with `chevronDown`. Selected: accent border + accent at
 * 8%, like a selected card.
 */
export function FilterChips({ chips, accessibilityLabel }: { chips: FilterChip[]; accessibilityLabel: string }) {
  const { size, border } = useAppTheme();
  const slop = (size.touchTarget - size.filterChip) / 2;
  return (
    <Box flexDirection="row" flexWrap="wrap" gap="s8" accessibilityLabel={accessibilityLabel}>
      {chips.map((chip) => (
        <Pressable
          key={chip.key}
          onPress={chip.onPress}
          hitSlop={{ top: slop, bottom: slop }}
          accessibilityRole="button"
          accessibilityState={{ selected: chip.selected }}
          accessibilityLabel={chip.accessibilityLabel ?? chip.label}
        >
          <Box
            height={size.filterChip}
            paddingHorizontal="s12"
            flexDirection="row"
            alignItems="center"
            gap="s4"
            borderRadius="sm"
            borderWidth={border.width}
            borderColor={chip.selected ? 'accent' : 'border'}
            backgroundColor={chip.selected ? 'accentSelected' : 'surface'}
          >
            <Text variant="caption" color={chip.selected ? 'accent' : 'text'}>
              {chip.label}
            </Text>
            {chip.icon ? <Icon name={chip.icon} size={size.badgeIcon} color={chip.selected ? 'accent' : 'textMuted'} /> : null}
          </Box>
        </Pressable>
      ))}
    </Box>
  );
}
