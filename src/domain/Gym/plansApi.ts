import { supabase } from '@infra/supabase';

/** Active plans of the catalog, in display order (anyone signed in). */
async function listPublic() {
  const { data, error } = await supabase.rpc('list_public_plans');
  if (error) throw error;
  return data;
}

type GeneratedPlanRow = Awaited<ReturnType<typeof listPublic>>[number];
/** The generator types every RPC column as non-null; `student_limit` is null for unlimited. */
export type PlanRowApi = Omit<GeneratedPlanRow, 'student_limit'> & { student_limit: number | null };

export const plansApi = { listPublic };
