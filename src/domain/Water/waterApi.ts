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

export const waterApi = { upsert };
