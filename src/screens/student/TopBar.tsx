import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { BELTS, Box, Icon, Text, type Belt } from '@components';
import { useAppTheme } from '@theme';

interface TopBarProps {
  streakWeeks: number;
  confirmedTotal: number;
  belt: Belt | null;
}

/**
 * Top bar of Início (11.1): weekly streak and confirmed classes side by side.
 * Tapping a counter opens the Aulas tab (its detail).
 */
export function TopBar({ streakWeeks, confirmedTotal, belt }: TopBarProps) {
  const { size, border, spacing } = useAppTheme();
  const open = () => router.navigate('/(tabs)/classes');
  const outlined = belt === 'white' || belt === 'black' || !belt;

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
          <Box
            width={size.icon}
            height={size.beltChipHeight}
            backgroundColor={belt ? BELTS[belt].color : 'disabled'}
            borderWidth={outlined ? border.width : 0}
            borderColor="border"
          />
          <Text variant="counter">{confirmedTotal}</Text>
        </Box>
      </Pressable>
      {/* TODO(phase3): water of today counter (drop icon in `water`). */}
    </Box>
  );
}
