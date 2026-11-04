import { plannedMlByDate, useWaterPlans } from '@domain/Competition';
import { localDate } from '@domain/Water';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';

/** Days of plan published to the widget (today + the next week). */
export const PLANNED_DAYS_AHEAD = 8;

/**
 * Professor's water plan for today and the next days, by local date (profile
 * time zone). Only competitors have one: for everybody else the query does not
 * run and the automatic goal applies.
 */
export function usePlannedWater(timeZone: string | undefined) {
  const { userId } = useSession();
  const { memberships } = useActiveGym();
  const competes = memberships.some((m) => m.status === 'active' && m.isCompetitor);
  const plans = useWaterPlans(userId, competes);
  const today = timeZone ? localDate(new Date(), timeZone) : undefined;

  const byDate = competes && plans.data && today ? plannedMlByDate(plans.data, today, PLANNED_DAYS_AHEAD) : {};
  return {
    today,
    byDate,
    plannedToday: today ? (byDate[today] ?? null) : null,
    /** Still loading the plan of a competitor (avoid publishing the automatic goal in between). */
    isLoading: competes && plans.isLoading,
  };
}
