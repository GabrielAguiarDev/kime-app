import { supabase } from '@infra/supabase';

/** Refreshes and returns the caller's Disciplina in the academy (see my_discipline). */
async function myDiscipline(academyId: string) {
  const { data, error } = await supabase.rpc('my_discipline', { p_academy_id: academyId });
  if (error) throw error;
  return data;
}

export const disciplineApi = { myDiscipline };
