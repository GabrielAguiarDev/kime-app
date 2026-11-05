import type { LocalDate, Weekday } from '@domain/Classes';
import { toAppError } from '@infra/supabase';

import { competitionApi as api, type ChampionshipRowApi, type WaterPlanRowApi } from './competitionApi';
import { emptyWeekLimits, emptyWeekTargets, limitsToArray, targetsToArray } from './competitionRules';
import type {
  Championship,
  ChampionshipEntry,
  ChampionshipInput,
  WaterPlan,
  WeekLimits,
  WeekTargets,
  WeightLog,
} from './competitionTypes';

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    throw toAppError(e);
  }
}

function toChampionship(row: ChampionshipRowApi): Championship {
  return {
    id: row.id,
    academyId: row.academy_id,
    modalityId: row.modality_id,
    name: row.name,
    eventDate: row.event_date,
    location: row.location,
  };
}

function toWaterPlan(row: WaterPlanRowApi): WaterPlan {
  const targets = emptyWeekTargets();
  const limits = emptyWeekLimits();
  for (const day of row.days) {
    targets[day.weekday as Weekday] = day.target_ml;
    limits[day.weekday as Weekday] = day.is_limit;
  }
  return { id: row.id, academyId: row.academy_id, weekStart: row.week_start, updatedAt: row.updated_at, targets, limits };
}

export const competitionService = {
  inviteCompetitor: (membershipId: string, modalityId: string) => call(() => api.inviteCompetitor(membershipId, modalityId)),
  respondInvite: (membershipId: string, modalityId: string, accept: boolean) =>
    call(() => api.respondInvite(membershipId, modalityId, accept)),
  removeCompetitor: (membershipId: string, modalityId: string) => call(() => api.removeCompetitor(membershipId, modalityId)),

  listChampionships: (academyId: string): Promise<Championship[]> =>
    call(async () => (await api.listChampionships(academyId)).map(toChampionship)),
  listMyChampionships: (athleteId: string): Promise<Championship[]> =>
    call(async () => (await api.listMyChampionships(athleteId)).map(toChampionship)),
  createChampionship: (academyId: string, input: ChampionshipInput) =>
    call(() => api.createChampionship(academyId, input.modalityId, input.name.trim(), input.eventDate, input.location.trim())),
  updateChampionship: (id: string, input: ChampionshipInput) =>
    call(() => api.updateChampionship(id, input.modalityId, input.name.trim(), input.eventDate, input.location.trim())),
  deleteChampionship: (id: string) => call(() => api.deleteChampionship(id)),
  listEntries: (academyId: string): Promise<ChampionshipEntry[]> =>
    call(async () =>
      (await api.listEntries(academyId)).map((r) => ({ championshipId: r.championship_id, athleteId: r.athlete_id })),
    ),
  setEntries: (championshipId: string, athleteIds: string[]) => call(() => api.setEntries(championshipId, athleteIds)),

  listWeights: (athleteId: string): Promise<WeightLog[]> =>
    call(async () =>
      (await api.listWeights(athleteId)).map((r) => ({ id: r.id, loggedOn: r.logged_on, weightKg: Number(r.weight_kg) })),
    ),
  /** One weigh-in per day: an existing day is corrected instead. */
  saveWeight: (athleteId: string, loggedOn: LocalDate, weightKg: number, existingId?: string) =>
    call(() => (existingId ? api.updateWeight(existingId, weightKg) : api.insertWeight(athleteId, loggedOn, weightKg))),
  deleteWeight: (id: string) => call(() => api.deleteWeight(id)),

  /** Staff: a competitor's water logs since an instant (ISO). */
  listAthleteWater: (athleteId: string, sinceIso: string): Promise<{ amountMl: number; loggedAt: string }[]> =>
    call(async () =>
      (await api.listAthleteWater(athleteId, sinceIso)).map((r) => ({ amountMl: r.amount_ml, loggedAt: r.logged_at })),
    ),
  listWaterPlans: (athleteId: string): Promise<WaterPlan[]> =>
    call(async () => (await api.listWaterPlans(athleteId)).map(toWaterPlan)),
  setWaterPlan: (academyId: string, athleteId: string, targets: WeekTargets, limits: WeekLimits) =>
    call(() => api.setWaterPlan(academyId, athleteId, targetsToArray(targets), limitsToArray(limits))),
};
