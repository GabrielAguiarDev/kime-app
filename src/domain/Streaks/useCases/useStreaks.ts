import { useQuery } from '@tanstack/react-query';

import { useAcademyToday, useMyCheckins } from '@domain/Classes';
import { localDate, waterService } from '@domain/Water';
import { QueryKeys } from '@infra/query';
import { toAppError } from '@infra/supabase';

import { streakApi } from '../streakApi';
import { mergeWaterDays, trainingStreak, waterStreak, type WaterDayTotal } from '../streakRules';

async function fetchWaterDays(): Promise<WaterDayTotal[]> {
  try {
    return (await streakApi.myWaterDays()).map((r) => ({ day: r.day, totalMl: r.total_ml, goalMl: r.goal_ml }));
  } catch (e) {
    throw toAppError(e);
  }
}

/**
 * Water streak of the signed-in user. Server history merged with the device's
 * last days (logs not synced yet, the widget's). Today uses `todayGoalMl`
 * (plan or automatic goal) so the flame lights as soon as the goal is reached.
 */
export function useWaterStreak(userId: string | undefined, timeZone: string | undefined, todayGoalMl: number | null) {
  const server = useQuery({
    queryKey: [QueryKeys.WaterDays, userId],
    queryFn: fetchWaterDays,
    enabled: !!userId,
  });
  // Re-read on every render: the device store changes with each log (no query of its own).
  const today = timeZone ? localDate(new Date(), timeZone) : undefined;
  const refetch = () => void server.refetch();
  // Without the server history the streak would be wrong (and a record baseline too).
  if (!userId || !timeZone || !today || !server.data) {
    return { streak: null, isLoading: server.isLoading, isError: server.isError, refetch };
  }

  const lastGoal = server.data.reduce<number | null>((g, d) => d.goalMl ?? g, null);
  const days = mergeWaterDays(
    server.data.map((d) => (d.day === today ? { ...d, goalMl: todayGoalMl ?? d.goalMl } : d)),
    waterService.localDayTotals(userId, timeZone),
    (day) => (day === today ? todayGoalMl : lastGoal ?? todayGoalMl),
  );
  return { streak: waterStreak(days, today), isLoading: server.isLoading, isError: server.isError, refetch };
}

/** Training streak in an academy: weeks with at least one confirmed class (academy calendar). */
export function useTrainingStreak(academyId: string | undefined, userId: string | undefined) {
  const today = useAcademyToday(academyId);
  const checkins = useMyCheckins(academyId, userId);
  const streak =
    today.data && checkins.data
      ? trainingStreak(
          checkins.data.filter((c) => c.status === 'confirmed').map((c) => c.classDate),
          today.data,
        )
      : null;
  return {
    streak,
    isLoading: today.isLoading || checkins.isLoading,
    isError: today.isError || checkins.isError,
    refetch: () => {
      void today.refetch();
      void checkins.refetch();
    },
  };
}

