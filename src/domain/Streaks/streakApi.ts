import { supabase } from '@infra/supabase';

/** Per local day: server total and the goal in force (see my_water_days). */
async function myWaterDays() {
  const { data, error } = await supabase.rpc('my_water_days');
  if (error) throw error;
  return data;
}

/** Records the goal a day had (history keeps it when weight or plan change). */
async function recordWaterGoal(userId: string, day: string, goalMl: number) {
  const { error } = await supabase
    .from('water_goal_days')
    .upsert({ user_id: userId, day, goal_ml: goalMl }, { onConflict: 'user_id,day' });
  if (error) throw error;
}

export const streakApi = { myWaterDays, recordWaterGoal };
