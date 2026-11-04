import { supabase } from '@infra/supabase';

import type { WaterLog } from './waterTypes';

/** Idempotent: the id comes from the device, so a retry updates the same row. */
async function upsert(userId: string, logs: WaterLog[]) {
  const { error } = await supabase.from('water_logs').upsert(
    logs.map((log) => ({
      id: log.id,
      user_id: userId,
      amount_ml: log.amountMl,
      logged_at: log.loggedAt,
    })),
    { onConflict: 'id' },
  );
  if (error) throw error;
}

/** RLS: only the user's own logs. */
async function remove(ids: string[]) {
  const { error } = await supabase.from('water_logs').delete().in('id', ids);
  if (error) throw error;
}

/** The user's logs since an instant (to restore today's after a reinstall). */
async function listSince(userId: string, sinceIso: string) {
  const { data, error } = await supabase
    .from('water_logs')
    .select('id, amount_ml, logged_at')
    .eq('user_id', userId)
    .gte('logged_at', sinceIso);
  if (error) throw error;
  return data;
}

export const waterApi = { upsert, remove, listSince };
export type WaterLogRowApi = Awaited<ReturnType<typeof listSince>>[number];
