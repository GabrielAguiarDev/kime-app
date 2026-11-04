import { supabase } from '@infra/supabase';

async function getById(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, weight_kg, height_cm, bottle_ml, timezone')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

async function updateName(userId: string, fullName: string) {
  const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', userId);
  if (error) throw error;
}

async function updateBodyAndBottle(
  userId: string,
  patch: { weight_kg: number | null; height_cm: number | null; bottle_ml: number | null },
) {
  // RLS: own profile only. Zero rows means it did not apply.
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

export const profileApi = { getById, updateName, updateBodyAndBottle };
export type ProfileRowApi = Awaited<ReturnType<typeof getById>>;
