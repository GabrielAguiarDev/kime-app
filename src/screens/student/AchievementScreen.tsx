import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { BELT_COLOR_TOKEN, Box, Button, KimiMascot, Screen, Text } from '@components';
import {
  beltName,
  beltNeedsDarkText,
  isBeltColorKey,
  useAcademyToday,
  useMemberStats,
  useMyCheckins,
  type BeltLook,
} from '@domain/Classes';
import { trainingStreak } from '@domain/Streaks';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';
import { useAppTheme, type ColorToken } from '@theme';
import { haptics } from '@utils/haptics';

type Params = { kind?: 'belt' | 'milestone'; beltPrimary?: string; beltTip?: string; value?: string };

/** Full-screen achievement (11.4): new belt or class milestone. */
export function AchievementScreen() {
  const { kind, beltPrimary, beltTip, value } = useLocalSearchParams<Params>();
  const { userId } = useSession();
  const { active } = useActiveGym();
  const stats = useMemberStats(active?.gymId);
  const checkins = useMyCheckins(active?.gymId, userId);
  const today = useAcademyToday(active?.gymId);

  useEffect(() => {
    haptics.success();
  }, []);

  const own = stats.data?.find((s) => s.userId === userId);
  const total = own?.confirmedTotal ?? Number(value ?? 0);
  const streak = today.data
    ? trainingStreak(
        (checkins.data ?? []).filter((c) => c.status === 'confirmed').map((c) => c.classDate),
        today.data,
      ).current
    : 0;
  const belt: BeltLook | null =
    kind === 'belt' && isBeltColorKey(beltPrimary)
      ? { primary: beltPrimary, tip: isBeltColorKey(beltTip) ? beltTip : null }
      : null;

  const title = belt
    ? `Faixa ${beltName(belt).toLowerCase()} conquistada`
    : `${value ?? total} aulas confirmadas`;

  return (
    <Screen scrollable={false} footer={<Button title="Continuar" onPress={() => router.back()} />}>
      {/* TODO(motion): title and stat cards entrance. */}
      <Box flex={1} alignItems="center" justifyContent="center" gap="s24">
        {/* New belt: graduation peeking with one eye (twice, then still). */}
        <KimiMascot size="hero" pose={belt ? 'graduation' : 'guard'} animated={!!belt} />
        <Text variant="title" textAlign="center" accessibilityRole="header">
          {title}
        </Text>
        <Box flexDirection="row" gap="s12" alignSelf="stretch">
          <StatCard label="Aulas" value={String(total)} header="accent" text="onAccent" />
          <StatCard label="Semanas" value={String(streak)} header="success" text="onSuccess" />
          {belt ? (
            <StatCard
              label="Faixa"
              value={beltName(belt)}
              header={BELT_COLOR_TOKEN[belt.primary]}
              text={beltNeedsDarkText(belt) ? 'onWarning' : 'onAccent'}
              compact
            />
          ) : null}
        </Box>
      </Box>
    </Screen>
  );
}

/** Stat card: colored header with the caption label, surface body with the number. */
function StatCard({
  label,
  value,
  header,
  headerColor,
  text,
  compact,
}: {
  label: string;
  value: string;
  header: ColorToken;
  /** Belt color (#RRGGBB, owner-defined data): replaces `header`. */
  headerColor?: string;
  text: ColorToken;
  /** Words instead of numbers (belt name) use a smaller variant. */
  compact?: boolean;
}) {
  const { border } = useAppTheme();
  return (
    <Box
      flex={1}
      borderRadius="lg"
      borderWidth={border.width}
      borderColor={header}
      style={headerColor ? { borderColor: headerColor } : undefined}
      overflow="hidden"
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Box
        backgroundColor={header}
        style={headerColor ? { backgroundColor: headerColor } : undefined}
        paddingVertical="s8"
        alignItems="center"
      >
        <Text variant="captionCaps" color={text}>
          {label}
        </Text>
      </Box>
      {/* flexGrow, not flex: flex={1} is a 0 basis, and in a card of auto height that left the
          body 0 tall (only the header showed). It still grows to match the tallest card. */}
      <Box backgroundColor="surface" paddingVertical="s16" alignItems="center" justifyContent="center" flexGrow={1}>
        <Text variant={compact ? 'heading' : 'displayLg'} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      </Box>
    </Box>
  );
}
