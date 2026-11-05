import { useQuery } from '@tanstack/react-query';

import type { LocalDate } from '@domain/Classes/classesTypes';
import { QueryKeys } from '@infra/query';
import { supabase, toAppError } from '@infra/supabase';

import type { MonthChampion, RankingEntry } from '../rankingRules';

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    throw toAppError(e);
  }
}

async function fetchRanking(academyId: string, month: LocalDate, modalityId: string | null): Promise<RankingEntry[]> {
  return call(async () => {
    const { data, error } = await supabase.rpc('academy_ranking', {
      p_academy_id: academyId,
      p_month: month,
      ...(modalityId ? { p_modality_id: modalityId } : {}),
    });
    if (error) throw error;
    return data.map((r) => ({
      position: r.position,
      userId: r.user_id,
      fullName: r.full_name || 'Sem nome',
      avatarPath: r.avatar_path,
      classes: r.classes,
    }));
  });
}

async function fetchChampions(academyId: string, modalityId: string | null): Promise<MonthChampion[]> {
  return call(async () => {
    const { data, error } = await supabase.rpc('academy_ranking_champions', {
      p_academy_id: academyId,
      ...(modalityId ? { p_modality_id: modalityId } : {}),
    });
    if (error) throw error;
    return data.map((r) => ({
      month: r.month,
      userId: r.user_id,
      fullName: r.full_name || 'Sem nome',
      avatarPath: r.avatar_path,
      classes: r.classes,
    }));
  });
}

/** Monthly ranking (confirmed classes), overall (modalityId null) or of one modality. */
export function useRanking(academyId: string | undefined, month: LocalDate | undefined, modalityId: string | null) {
  return useQuery({
    queryKey: [QueryKeys.Ranking, academyId, month, modalityId],
    queryFn: () => fetchRanking(academyId!, month!, modalityId),
    enabled: !!academyId && !!month,
  });
}

/** Champions of the finished months. */
export function useRankingChampions(academyId: string | undefined, modalityId: string | null) {
  return useQuery({
    queryKey: [QueryKeys.RankingChampions, academyId, modalityId],
    queryFn: () => fetchChampions(academyId!, modalityId),
    enabled: !!academyId,
  });
}
