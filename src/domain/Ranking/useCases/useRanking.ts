import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';
import { supabase, toAppError } from '@infra/supabase';

import type { Json } from '@infra/supabase/database.types';

import { calculateRanking, type AttendanceFact, type HydrationFact, type RankingFacts } from '../rankingRules';

function objects(value: Json): { [key: string]: Json | undefined }[] {
  if (!Array.isArray(value)) throw new Error('Resposta inválida do ranking.');
  return value.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Atividade inválida no ranking.');
    return row;
  });
}
function attendanceFacts(value: Json): AttendanceFact[] {
  return objects(value).map((r) => {
    if (typeof r.id !== 'string' || typeof r.day !== 'string' || typeof r.done !== 'boolean') throw new Error('Aula inválida no ranking.');
    return { id: r.id, day: r.day, done: r.done };
  });
}
function hydrationFacts(value: Json): HydrationFact[] {
  return objects(value).map((r) => {
    if (typeof r.day !== 'string' || typeof r.known !== 'boolean' || typeof r.done !== 'boolean' || typeof r.eligible !== 'boolean') throw new Error('Dia inválido no ranking.');
    return { day: r.day, known: r.known, done: r.done, eligible: r.eligible };
  });
}

export interface RankingPeriod { from: string; to: string }
export interface RankingRequest {
  academyId: string;
  modalityId: string;
  startDate: string;
  endDate: string;
}

export async function fetchRanking({ academyId, modalityId, startDate, endDate }: RankingRequest) {
  try {
    const { data, error } = await supabase.rpc('academy_ranking_facts', {
      p_academy_id: academyId,
      p_modality_id: modalityId,
      p_from: startDate,
      p_to: endDate,
    });
    if (error) throw error;
    const facts: RankingFacts[] = data.map((r) => ({
      modalityId: r.modality_id, userId: r.user_id, fullName: r.full_name || 'Sem nome', avatarPath: r.avatar_path,
      today: r.today, periodFrom: r.period_from, periodTo: r.period_to,
      attendance: attendanceFacts(r.attendance), hydration: hydrationFacts(r.hydration),
    }));
    return calculateRanking(facts, modalityId);
  } catch (e) { throw toAppError(e); }
}

/** One independent query/cache entry per modality and complete date interval. */
export function rankingQueryKey(academyId: string | undefined, modalityId: string | undefined, period: RankingPeriod | undefined) {
  return [QueryKeys.Ranking, academyId, modalityId, period?.from, period?.to] as const;
}

export function useRanking(academyId: string | undefined, modalityId: string | undefined, period: RankingPeriod | undefined) {
  return useQuery({
    queryKey: rankingQueryKey(academyId, modalityId, period),
    queryFn: () => fetchRanking({ academyId: academyId!, modalityId: modalityId!, startDate: period!.from, endDate: period!.to }),
    enabled: !!academyId && !!modalityId && !!period,
    refetchInterval: 60_000,
  });
}
