import { ActivityIndicator } from 'react-native';

import { Box, Button, EmptyState, MascotBalloon } from '@components';
import {
  useAcademyToday,
  useBelts,
  useModalityStats,
  useMyCheckins,
  useSchedules,
} from '@domain/Classes';
import { trainingStreak } from '@domain/Streaks';
import { CompetitorInviteCard } from '@screens/competition/CompetitorInviteCard';
import { useActiveGym } from '@services/activeGym';
import { useActiveModality } from '@services/activeModality';
import { useClassRewards } from '@services/classRewards';
import { useSession } from '@services/session';

import { CheckinConfirmedSheet } from './CheckinConfirmedSheet';
import { TodayClasses } from './TodayClasses';
import { TopBar } from './TopBar';

/**
 * Início of a student/competitor: top bar, today's classes, mascot reminder,
 * rewards. Classes, belt and total follow the modality picked in the header;
 * the training streak counts every modality.
 */
export function StudentHome() {
  const { userId } = useSession();
  const { active } = useActiveGym();
  const { selected, modalities } = useActiveModality();
  const academyId = active?.gymId;

  const today = useAcademyToday(academyId);
  const schedules = useSchedules(academyId);
  const checkins = useMyCheckins(academyId, userId);
  const modalityStats = useModalityStats(academyId);
  const belts = useBelts(academyId);
  const rewards = useClassRewards(academyId, userId);

  const queries = [today, schedules, checkins, modalityStats, belts];
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

  const own = modalityStats.data?.find((s) => s.userId === userId && s.modalityId === selected?.id);
  const belt = selected?.usesBelts && own?.beltId ? (belts.data ?? []).find((b) => b.id === own.beltId) ?? null : null;
  const modalitySchedules = (schedules.data ?? []).filter((s) => s.modalityId === selected?.id);
  const list = checkins.data ?? [];
  // Only the selected modality: a pending check-in of another one does not talk here.
  const pendingToday = list.some(
    (c) => c.status === 'pending' && c.classDate === today.data && c.modalityId === selected?.id,
  );
  const streak = trainingStreak(
    list.filter((c) => c.status === 'confirmed').map((c) => c.classDate),
    today.data,
  );

  return (
    <Box gap="s24">
      <TopBar
        streakWeeks={streak.current}
        streakDone={streak.currentDone}
        confirmedTotal={own?.confirmedTotal ?? 0}
        showBelt={!!selected?.usesBelts}
        belt={belt}
      />
      {active
        ? modalities
            .filter((m) => m.link.competitorInvitedAt)
            .map((m) => <CompetitorInviteCard key={m.id} membership={active} modality={m} />)
        : null}
      <TodayClasses
        academyId={academyId}
        userId={userId}
        today={today.data}
        schedules={modalitySchedules}
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
