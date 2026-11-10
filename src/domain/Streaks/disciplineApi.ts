import { supabase } from '@infra/supabase';

/** Refreshes and returns the caller's Disciplina (see my_discipline). */
async function myDiscipline() {
  const { data, error } = await supabase.rpc('my_discipline');
  if (error) throw error;
  return data;
}

export const disciplineApi = { myDiscipline };
