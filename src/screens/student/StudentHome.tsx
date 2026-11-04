import { ActivityIndicator } from 'react-native';

import { Box, Button, EmptyState, MascotBalloon } from '@components';
import { useAcademyToday, useMemberStats, useMyCheckins, useSchedules, weeklyStreak } from '@domain/Classes';
import { useActiveGym } from '@services/activeGym';
import { useClassRewards } from '@services/classRewards';
import { useSession } from '@services/session';

import { CheckinConfirmedSheet } from './CheckinConfirmedSheet';
import { TodayClasses } from './TodayClasses';
import { TopBar } from './TopBar';

/** Início of a student/competitor: top bar, today's classes, mascot reminder, rewards. */
export function StudentHome() {
  const { userId } = useSession();
  const { active } = useActiveGym();
  const academyId = active?.gymId;

  const today = useAcademyToday(academyId);
  const schedules = useSchedules(academyId);
  const checkins = useMyCheckins(academyId, userId);
  const stats = useMemberStats(academyId);
  const rewards = useClassRewards(academyId, userId);

  const queries = [today, schedules, checkins, stats];
  if (queries.some((q) => q.isLoading)) {
    return <ActivityIndicator accessibilityLabel="Carregando" />;
  }
  if (queries.some((q) => q.isError) || !today.data || !academyId || !userId) {
    return (
      <EmptyState
        visual="icon"
        icon="offline"
        title="Não foi possível carregar suas aulas"
        action={<Button title="Tentar de novo" variant="secondary" onPress={() => queries.forEach((q) => q.refetch())} />}
      />
    );
  }

  const own = stats.data?.find((s) => s.userId === userId);
  const list = checkins.data ?? [];
  const confirmedDates = list.filter((c) => c.status === 'confirmed').map((c) => c.classDate);
  const pendingToday = list.some((c) => c.status === 'pending' && c.classDate === today.data);

  return (
    <Box gap="s24">
      <TopBar
        streakWeeks={weeklyStreak(confirmedDates, today.data)}
        confirmedTotal={own?.confirmedTotal ?? 0}
        belt={own?.belt ?? null}
      />
      <TodayClasses
        academyId={academyId}
        userId={userId}
        today={today.data}
        schedules={schedules.data ?? []}
        checkins={list}
      />
      {pendingToday ? <MascotBalloon message="Check-in enviado. Aguardando o professor." /> : null}
      <CheckinConfirmedSheet
        count={rewards.confirmedCount}
        total={own?.confirmedTotal ?? 0}
        onClose={rewards.dismissConfirmed}
      />
    </Box>
  );
}
