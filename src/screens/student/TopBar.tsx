import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { BeltSwatch, Box, Icon, Text } from '@components';
import type { BeltLook } from '@domain/Classes';
import { useAppTheme } from '@theme';

interface TopBarProps {
  streakWeeks: number;
  confirmedTotal: number;
  /** Latest belt across modalities (strip color); null = no belt yet. */
  belt: BeltLook | null;
}

/**
 * Top bar of Início (11.1): weekly streak and confirmed classes. Today's water
 * lives in the header (top right), the same for students and staff.
 * Tapping a counter opens its detail (Aulas tab).
 */
export function TopBar({ streakWeeks, confirmedTotal, belt }: TopBarProps) {
  const { size, spacing } = useAppTheme();
  const open = () => router.navigate('/(tabs)/classes');

  return (
    <Box flexDirection="row" gap="s24">
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${streakWeeks} ${streakWeeks === 1 ? 'semana seguida' : 'semanas seguidas'} treinando`}
        hitSlop={spacing.s8}
      >
        <Box flexDirection="row" alignItems="center" gap="s8">
          <Icon name="flame" color={streakWeeks > 0 ? 'accent' : 'disabled'} active={streakWeeks > 0} />
          <Text variant="counter">{streakWeeks}</Text>
        </Box>
      </Pressable>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${confirmedTotal} ${confirmedTotal === 1 ? 'aula confirmada' : 'aulas confirmadas'}`}
        hitSlop={spacing.s8}
      >
        <Box flexDirection="row" alignItems="center" gap="s8">
          {/* Belt icon: a 24-wide strip in the student's belt color. */}
          <BeltSwatch belt={belt} width={size.icon} height={size.beltChipHeight} />
          <Text variant="counter">{confirmedTotal}</Text>
        </Box>
      </Pressable>
    </Box>
  );
}
