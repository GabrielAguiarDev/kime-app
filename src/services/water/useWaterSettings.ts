import { useMyProfile } from '@domain/Profile';
import { dailyGoal, goalOnDate, localDate, waterService } from '@domain/Water';
import { useSession } from '@services/session';

import { usePlannedWater } from './usePlannedWater';

export interface WaterSettings {
  timeZone: string;
  bottleMl: number | null;
  goalMl: number | null;
  isLimit: boolean;
  /** `plan`: today's goal comes from the professor's weekly plan. */
  goalSource: 'plan' | 'auto' | null;
}

/**
 * Bottle, goal and time zone for the water screens. From the profile when it is
 * loaded; otherwise (offline cold start) from the config last published for the
 * widgets, so water keeps working without network — like the widget does.
 * Competitors: the professor's plan for today replaces the automatic goal.
 */
export function useWaterSettings() {
  const { userId } = useSession();
  const profile = useMyProfile(userId);
  const planned = usePlannedWater(profile.data?.timeZone);

  let settings: WaterSettings | null = null;
  if (profile.data) {
    const goal = dailyGoal({ weightKg: profile.data.weightKg, plannedMl: planned.plannedToday });
    settings = {
      timeZone: profile.data.timeZone,
      bottleMl: profile.data.bottleMl,
      goalMl: goal.goalMl,
      isLimit: planned.isLimitToday,
      goalSource: goal.source,
    };
  } else {
    const cached = waterService.readConfig();
    if (cached && cached.userId === userId) {
      const today = localDate(new Date(), cached.timeZone);
      const fromPlan = cached.goalsByDate?.[today] !== undefined;
      const goalMl = goalOnDate(cached, today);
      settings = {
        timeZone: cached.timeZone,
        bottleMl: cached.bottleMl,
        goalMl,
        isLimit: !!cached.limitsByDate?.[today],
        goalSource: fromPlan ? 'plan' : goalMl === null ? null : 'auto',
      };
    }
  }

  return {
    userId,
    settings,
    isLoading: !settings && profile.isLoading,
    isError: !settings && profile.isError,
    refetch: () => void profile.refetch(),
  };
}
