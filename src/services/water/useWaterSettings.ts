import { useMyProfile } from '@domain/Profile';
import { dailyGoal, waterService } from '@domain/Water';
import { useSession } from '@services/session';

export interface WaterSettings {
  timeZone: string;
  bottleMl: number | null;
  goalMl: number | null;
}

/**
 * Bottle, goal and time zone for the water screens. From the profile when it is
 * loaded; otherwise (offline cold start) from the config last published for the
 * widgets, so water keeps working without network — like the widget does.
 */
export function useWaterSettings() {
  const { userId } = useSession();
  const profile = useMyProfile(userId);

  let settings: WaterSettings | null = null;
  if (profile.data) {
    settings = {
      timeZone: profile.data.timeZone,
      bottleMl: profile.data.bottleMl,
      goalMl: dailyGoal({ weightKg: profile.data.weightKg }).goalMl,
    };
  } else {
    const cached = waterService.readConfig();
    if (cached && cached.userId === userId) {
      settings = { timeZone: cached.timeZone, bottleMl: cached.bottleMl, goalMl: cached.goalMl };
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
