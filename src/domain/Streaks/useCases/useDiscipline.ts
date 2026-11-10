import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';
import { toAppError } from '@infra/supabase';

import { disciplineApi } from '../disciplineApi';
import { parseDiscipline } from '../disciplineRules';

async function fetchDiscipline() {
  try {
    return parseDiscipline(await disciplineApi.myDiscipline());
  } catch (e) {
    throw toAppError(e);
  }
}

/**
 * The signed-in user's Disciplina, from the database. Re-read every minute
 * (the professor may confirm a class meanwhile) and after water sync and
 * check-ins (they invalidate QueryKeys.Discipline).
 */
export function useDiscipline(userId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.Discipline, userId],
    queryFn: fetchDiscipline,
    enabled: !!userId,
    refetchInterval: 60_000,
  });
}
