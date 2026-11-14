import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';
import { toAppError } from '@infra/supabase';

import { disciplineApi } from '../disciplineApi';
import { parseDiscipline } from '../disciplineRules';

async function fetchDiscipline(academyId: string) {
  try {
    return parseDiscipline(await disciplineApi.myDiscipline(academyId));
  } catch (e) {
    throw toAppError(e);
  }
}

/**
 * The signed-in user's Disciplina in the academy (one streak per academy: personal
 * water + classes of THAT academy), from the database. Re-read every minute
 * (the professor may confirm a class meanwhile) and after water sync and
 * check-ins (they invalidate QueryKeys.Discipline).
 */
export function useDiscipline(userId: string | undefined, academyId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.Discipline, userId, academyId],
    queryFn: () => fetchDiscipline(academyId!),
    enabled: !!userId && !!academyId,
    refetchInterval: 60_000,
  });
}
