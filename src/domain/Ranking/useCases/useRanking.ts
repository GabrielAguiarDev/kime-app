import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';
import { supabase, toAppError } from '@infra/supabase';

import type { RankingEntry } from '../rankingRules';

export interface RankingPeriod { from: string; to: string }
export interface RankingRequest {
  academyId: string;
  modalityId: string;
  startDate: string;
  endDate: string;
}

export async function fetchRanking({ academyId, modalityId }: RankingRequest): Promise<RankingEntry[]> {
  try {
    const [ranking, details] = await Promise.all([
      supabase.from('ranking_snapshots').select('*').eq('academy_id', academyId).eq('modality_id', modalityId).order('position', { nullsFirst: false }).order('score', { ascending: false }),
      supabase.from('ranking_details').select('*').eq('academy_id', academyId).eq('modality_id', modalityId),
    ]);
    if (ranking.error) throw ranking.error;
    if (details.error) throw details.error;
    const ownDetails = new Map(details.data.map((d) => [d.user_id, d]));
    return ranking.data.map((r): RankingEntry => {
      const d = ownDetails.get(r.user_id);
      return {
        modalityId: r.modality_id, userId: r.user_id, fullName: r.full_name, avatarPath: r.avatar_path,
        position: r.position, rankingScore: Number(r.score), status: r.status as RankingEntry['status'],
        attendanceRate: Number(d?.attendance_rate ?? 0), hydrationRate: Number(d?.hydration_rate ?? 0),
        confirmedClasses: d?.confirmed_classes ?? 0, weeklyGoal: d?.weekly_goal ?? 0,
        weeks: d?.weeks ?? 0, hydrationGoalsAchieved: d?.hydration_goals_achieved ?? 0,
        eligibleHydrationDays: d?.eligible_hydration_days ?? 0, protectedDays: d?.protected_days ?? 0,
        eligibleDays: d?.eligible_days ?? 0, daysToQualify: d?.days_to_qualify ?? 0,
      };
    });
  } catch (e) { throw toAppError(e); }
}

export async function recalculateRanking(academyId: string) {
  const { error } = await supabase.rpc('recalculate_ranking', { p_academy_id: academyId });
  if (error) throw toAppError(error);
}

/** One independent query/cache entry per modality and complete date interval. */
export function rankingQueryKey(academyId: string | undefined, modalityId: string | undefined, period: RankingPeriod | undefined) {
  return [QueryKeys.Ranking, academyId, modalityId, period?.from, period?.to] as const;
}

/** Modalities the caller may rank: every modality of the academy for staff, the student's own (active) ones. */
export function useRankingModalities(academyId: string, userId: string | undefined, period: RankingPeriod | undefined) {
  return useQuery({
    queryKey: [QueryKeys.RankingModalities, academyId, userId, period?.from, period?.to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ranking_modalities', {
        p_academy_id: academyId, p_from: period!.from, p_to: period!.to,
      });
      if (error) throw toAppError(error);
      return data.map((r) => ({ id: r.modality_id, name: r.name }));
    },
    enabled: !!userId && !!period,
    refetchInterval: 60_000,
  });
}

export function useRanking(academyId: string | undefined, modalityId: string | undefined, period: RankingPeriod | undefined) {
  return useQuery({
    queryKey: rankingQueryKey(academyId, modalityId, period),
    queryFn: () => fetchRanking({ academyId: academyId!, modalityId: modalityId!, startDate: period!.from, endDate: period!.to }),
    enabled: !!academyId && !!modalityId && !!period,
    refetchInterval: 60_000,
  });
}
