import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { BeltSwatch, Box, Icon, Text } from '@components';
import type { BeltLook } from '@domain/Classes';
import { useAppTheme } from '@theme';

interface TopBarProps {
  streakWeeks: number;
  /** This week already has a confirmed class (flame lit). */
  streakDone: boolean;
  confirmedTotal: number;
  /** Latest belt across modalities (strip color); null = no belt yet. */
  belt: BeltLook | null;
}

/**
 * Top bar of Início (11.1): weekly streak and confirmed classes. Today's water
 * lives in the header (top right), the same for students and staff.
 * The flame opens Ofensivas; the classes counter opens the Aulas tab.
 */
export function TopBar({ streakWeeks, streakDone, confirmedTotal, belt }: TopBarProps) {
  const { size, spacing } = useAppTheme();
  const open = () => router.navigate('/(tabs)/classes');

  return (
    <Box flexDirection="row" gap="s24">
      <Pressable
        onPress={() => router.push('/ofensivas')}
        accessibilityRole="button"
        accessibilityLabel={`${streakWeeks} ${streakWeeks === 1 ? 'semana seguida' : 'semanas seguidas'} treinando. Ver ofensivas`}
        hitSlop={spacing.s8}
      >
        <Box flexDirection="row" alignItems="center" gap="s8">
          <Icon name="flame" color={streakWeeks > 0 || streakDone ? 'accent' : 'disabled'} active={streakDone} />
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
