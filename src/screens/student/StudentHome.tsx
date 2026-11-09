import { ActivityIndicator } from 'react-native';

import { Box, Button, EmptyState } from '@components';
import {
  useAcademyToday,
  useModalityStats,
  useMyCheckins,
  useSchedules,
} from '@domain/Classes';
import { upcomingChampionships, useChampionships } from '@domain/Competition';
import { rankingPeriod, useRanking } from '@domain/Ranking';
import { trainingStreak, useWaterStreak } from '@domain/Streaks';
import { CompetitorInviteCard } from '@screens/competition/CompetitorInviteCard';
import { useLogBottle } from '@screens/water/useLogBottle';
import { useActiveGym } from '@services/activeGym';
import { useActiveModality } from '@services/activeModality';
import { useClassRewards } from '@services/classRewards';
import { useSession } from '@services/session';

import { CheckinConfirmedSheet } from './CheckinConfirmedSheet';
import { ChampionshipCard } from './home/ChampionshipCard';
import { NextClassCard } from './home/NextClassCard';
import { RankingCard } from './home/RankingCard';
import { WaterCard } from './home/WaterCard';
import { WeekCard } from './home/WeekCard';

/**
 * Início of a student (competitor or not), for the modality picked in the
 * header. Never empty: every section has a useful state without data.
 * Next class · championship · water · the week ·
 * ranking. Rewards (confirmed check-in) on top.
 */
export function StudentHome({ onJoinedTeam }: { onJoinedTeam: () => void }) {
  const { userId } = useSession();
  const { active } = useActiveGym();
  const { selected, modalities } = useActiveModality();
  const academyId = active?.gymId;

  const today = useAcademyToday(academyId);
  const schedules = useSchedules(academyId);
  const checkins = useMyCheckins(academyId, userId);
  const modalityStats = useModalityStats(academyId);
  const championships = useChampionships(academyId);
  const rewards = useClassRewards(academyId, userId);
  const period = today.data ? rankingPeriod(today.data) : undefined;
  const ranking = useRanking(academyId, selected?.id, period);
  const water = useLogBottle();
  const waterStreak = useWaterStreak(water.userId, water.timeZone, water.goalMl, water.isLimit);

  const queries = [today, schedules, checkins, modalityStats];
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

  const list = checkins.data ?? [];
  const own = modalityStats.data?.find((s) => s.userId === userId && s.modalityId === selected?.id);
  const modalitySchedules = (schedules.data ?? []).filter((s) => s.active && s.modalityId === selected?.id);
  const ofModality = list.filter((c) => c.modalityId === selected?.id);
  const training = trainingStreak(
    list.filter((c) => c.status === 'confirmed').map((c) => c.classDate),
    today.data,
  );
  const trainedDays = new Set(ofModality.filter((c) => c.status === 'confirmed').map((c) => c.classDate));
  const waterDoneDays = new Set((waterStreak.streak?.periods ?? []).filter((p) => p.state === 'done').map((p) => p.key));
  const upcoming = upcomingChampionships(
    (championships.data ?? []).filter((c) => c.modalityId === selected?.id),
    today.data,
  );


  return (
    <Box gap="s24" paddingTop="s16">
      {active
        ? modalities
            .filter((m) => m.link.competitorInvitedAt)
            .map((m) => (
              <CompetitorInviteCard key={m.id} membership={active} modality={m} onAccepted={onJoinedTeam} />
            ))
        : null}

      <NextClassCard
        academyId={academyId}
        userId={userId}
        today={today.data}
        schedules={modalitySchedules}
        checkins={list}
      />

      {upcoming.length ? <ChampionshipCard championships={upcoming} today={today.data} userId={userId} /> : null}

      <WaterCard />

      <WeekCard
        today={today.data}
        trainedDays={trainedDays}
        waterDoneDays={waterDoneDays}
        weeklyGoal={selected?.link.weeklyClassGoal ?? selected?.weeklyClassGoal ?? 2}
        training={training}
        water={waterStreak.streak}
        timeZone={water.timeZone}
      />

      <RankingCard entries={ranking.data ?? []} userId={userId} />

      <CheckinConfirmedSheet
        count={rewards.confirmedCount}
        total={own?.confirmedTotal ?? 0}
        onClose={rewards.dismissConfirmed}
      />
    </Box>
  );
}
