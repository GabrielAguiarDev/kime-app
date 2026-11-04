import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { Box, Icon, Text } from '@components';
import { useWaterDay } from '@domain/Water';
import { useWaterSettings } from '@services/water';
import { useAppTheme } from '@theme';

import { formatMl } from './format';

/**
 * Water of today (11.1): drop in `water` + ml. Opens the water screen.
 * `inHeader`: inside the iOS glass capsule of the native header, with inner
 * room so the number does not touch its edge (the drop glyph already has
 * its own side bearing, so the right side gets more).
 */
export function WaterCounter({ inHeader = false }: { inHeader?: boolean }) {
  const { spacing } = useAppTheme();
  const { userId, settings } = useWaterSettings();
  const { data: day } = useWaterDay(userId, settings?.timeZone);
  const total = day?.totalMl ?? 0;

  return (
    <Pressable
      onPress={() => router.push('/agua')}
      accessibilityRole="button"
      accessibilityLabel={`${formatMl(total)} ml de água hoje`}
      hitSlop={spacing.s8}
    >
      <Box
        flexDirection="row"
        alignItems="center"
        gap="s8"
        paddingLeft={inHeader ? "s4" : undefined}
        paddingRight={inHeader ? "s8" : undefined}
      >
        <Icon name="drop" color={total > 0 ? 'water' : 'disabled'} active={total > 0} />
        <Text variant="counter">{formatMl(total)}</Text>
      </Box>
    </Pressable>
  );
}
