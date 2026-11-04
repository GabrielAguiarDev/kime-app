import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { Box, Icon, Text } from '@components';
import { useWaterDay } from '@domain/Water';
import { useWaterSettings } from '@services/water';
import { useAppTheme } from '@theme';

import { formatMl } from './format';

/** Water of today in the top bar of Início (11.1): drop in `water` + ml. Opens the water screen. */
export function WaterCounter() {
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
      <Box flexDirection="row" alignItems="center" gap="s8">
        <Icon name="drop" color={total > 0 ? 'water' : 'disabled'} active={total > 0} />
        <Text variant="counter">{formatMl(total)}</Text>
      </Box>
    </Pressable>
  );
}
