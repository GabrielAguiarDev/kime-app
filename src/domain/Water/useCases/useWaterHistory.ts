import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';
import { toAppError } from '@infra/supabase';

import { waterApi } from '../waterApi';
import { mergeWaterDays, type WaterDayTotal } from '../waterHistory';
import { localDate } from '../waterRules';
import { waterService } from '../waterService';

async function fetchWaterDays(): Promise<WaterDayTotal[]> {
  try {
    return (await waterApi.myWaterDays()).map((r) => ({ day: r.day, totalMl: r.total_ml, goalMl: r.goal_ml, isLimit: r.is_limit }));
  } catch (e) {
    throw toAppError(e);
  }
}

/**
 * Per-day water totals and goals of the signed-in user (the last days bars):
 * server history merged with the device's (logs not synced yet, the widget's).
 * Today uses `todayGoalMl` (plan or automatic goal).
 */
export function useWaterHistory(userId: string | undefined, timeZone: string | undefined, todayGoalMl: number | null, todayIsLimit = false) {
  const server = useQuery({
    queryKey: [QueryKeys.WaterDays, userId],
    queryFn: fetchWaterDays,
    enabled: !!userId,
  });
  // Re-read on every render: the device store changes with each log (no query of its own).
  const today = timeZone ? localDate(new Date(), timeZone) : undefined;
  if (!userId || !timeZone || !today || !server.data) return [] as WaterDayTotal[];
  const lastGoal = server.data.reduce<number | null>((g, d) => d.goalMl ?? g, null);
  return mergeWaterDays(
    server.data.map((d) => (d.day === today ? { ...d, goalMl: todayGoalMl ?? d.goalMl, isLimit: todayIsLimit } : d)),
    waterService.localDayTotals(userId, timeZone),
    (day) => (day === today ? todayGoalMl : lastGoal ?? todayGoalMl),
    (day) => day === today && todayIsLimit,
  );
}
