import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { BELTS, Box, Button, Mascot, Screen, Text, type Belt } from '@components';
import { useAcademyToday, useMemberStats, useMyCheckins, weeklyStreak } from '@domain/Classes';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';
import { useAppTheme, type ColorToken } from '@theme';
import { haptics } from '@utils/haptics';

type Params = { kind?: 'belt' | 'milestone'; belt?: Belt; value?: string };

// Light belts need dark text on their header.
const DARK_TEXT_BELTS: Belt[] = ['white', 'yellow'];

/** Full-screen achievement (11.4): new belt or class milestone. */
export function AchievementScreen() {
  const { kind, belt, value } = useLocalSearchParams<Params>();
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
  const confirmedDates = (checkins.data ?? []).filter((c) => c.status === 'confirmed').map((c) => c.classDate);
  const streak = today.data ? weeklyStreak(confirmedDates, today.data) : 0;
  const beltInfo = kind === 'belt' && belt && BELTS[belt] ? BELTS[belt] : null;

  const title = beltInfo
    ? `Faixa ${beltInfo.label.toLowerCase()} conquistada`
    : `${value ?? total} aulas confirmadas`;

  return (
    <Screen scrollable={false} footer={<Button title="Continuar" onPress={() => router.back()} />}>
      {/* TODO(motion): achievement entrance (mascot, title and stat cards). */}
      <Box flex={1} alignItems="center" justifyContent="center" gap="s24">
        <Mascot size="hero" expression="celebrating" />
        <Text variant="title" textAlign="center" accessibilityRole="header">
          {title}
        </Text>
        <Box flexDirection="row" gap="s12" alignSelf="stretch">
          <StatCard label="Aulas" value={String(total)} header="accent" text="onAccent" />
          <StatCard label="Semanas" value={String(streak)} header="success" text="onSuccess" />
          {beltInfo && belt ? (
            <StatCard
              label="Faixa"
              value={beltInfo.label}
              header={beltInfo.color}
              text={DARK_TEXT_BELTS.includes(belt) ? 'onWarning' : 'onAccent'}
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
  text,
  compact,
}: {
  label: string;
  value: string;
  header: ColorToken;
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
      overflow="hidden"
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Box backgroundColor={header} paddingVertical="s8" alignItems="center">
        <Text variant="captionCaps" color={text}>
          {label}
        </Text>
      </Box>
      <Box backgroundColor="surface" paddingVertical="s16" alignItems="center" justifyContent="center" flex={1}>
        <Text variant={compact ? 'heading' : 'displayLg'} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      </Box>
    </Box>
  );
}
