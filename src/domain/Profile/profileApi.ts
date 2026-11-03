import { supabase } from '@infra/supabase';

async function getById(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

async function updateName(userId: string, fullName: string) {
  const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', userId);
  if (error) throw error;
}

export const profileApi = { getById, updateName };
export type ProfileRowApi = Awaited<ReturnType<typeof getById>>;
