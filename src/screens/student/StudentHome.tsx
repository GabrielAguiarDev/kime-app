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
import { useDiscipline } from '@domain/Streaks';
import { waterDayState } from '@domain/Water';
import { StudentAnnouncementsSection } from '@screens/announcements/HomeAnnouncementsSection';
import { CompetitorInviteCard } from '@screens/competition/CompetitorInviteCard';
import { StudentEventsSection } from '@screens/events/HomeEventsSection';
import { BlockedNotice, FinanceNotice, useMyFinance } from '@screens/finance/StudentFinance';
import { useLogBottle } from '@screens/water/useLogBottle';
import { useActiveGym } from '@services/activeGym';
import { useActiveModality } from '@services/activeModality';
import { useSession } from '@services/session';

import { ChampionshipCard } from './home/ChampionshipCard';
import { NextClassCard } from './home/NextClassCard';
import { RankingCard } from './home/RankingCard';
import { WaterCard } from './home/WaterCard';
import { WeekCard } from './home/WeekCard';

/**
 * Início of a student (competitor or not), for the modality picked in the
 * header. Never empty: every section has a useful state without data.
 * Own overdue fee notice · academy notice · next class · championship · event · water · the week ·
 * ranking. A student blocked for an overdue fee sees the fee notice, the academy notice and water only. Rewards (belt, milestone, confirmed check-in) are handled by HomeScreen.
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
  const period = today.data ? rankingPeriod(today.data) : undefined;
  const ranking = useRanking(academyId, selected?.id, period);
  const water = useLogBottle();
  const discipline = useDiscipline(userId);

  const finance = useMyFinance();

  // Overdue fee with the block on: the academy features give way to the notice; water stays.
  if (finance.blocked) {
    return (
      <Box gap="s24" paddingTop="s16">
        <BlockedNotice compact />
        {academyId && today.data ? <StudentAnnouncementsSection academyId={academyId} today={today.data} /> : null}
        <WaterCard />
      </Box>
    );
  }

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
  const modalitySchedules = (schedules.data ?? []).filter((s) => s.active && s.modalityId === selected?.id);
  const ofModality = list.filter((c) => c.modalityId === selected?.id);
  const trainedDays = new Set(ofModality.filter((c) => c.status === 'confirmed').map((c) => c.classDate));
  const upcoming = upcomingChampionships(
    (championships.data ?? []).filter((c) => c.modalityId === selected?.id),
    today.data,
  );


  return (
    <Box gap="s24" paddingTop="s16">
      <FinanceNotice />

      <StudentAnnouncementsSection academyId={academyId} today={today.data} />

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

      <StudentEventsSection academyId={academyId} userId={userId} today={today.data} />

      <WaterCard />

      <WeekCard
        today={today.data}
        trainedDays={trainedDays}
        classDays={new Set(modalitySchedules.map((s) => s.weekday)).size}
        discipline={discipline.data ?? null}
        todayWaterDone={water.date === today.data && waterDayState(water.totalMl, water.goalMl, water.isLimit) === 'done'}
        timeZone={water.timeZone}
      />

      <RankingCard entries={ranking.data ?? []} userId={userId} />
    </Box>
  );
}
