import { supabase } from '@infra/supabase';

/** Diet days of an athlete between two dates (inclusive), every academy the caller can read. */
async function listDays(athleteId: string, from: string, to: string) {
  const { data, error } = await supabase
    .from('diet_plans')
    .select('id, academy_id, plan_date, meals:diet_plan_meals(id, position, name, meal_time, description)')
    .eq('athlete_id', athleteId)
    .gte('plan_date', from)
    .lte('plan_date', to);
  if (error) throw error;
  return data;
}

async function saveMeal(
  academyId: string,
  athleteId: string,
  planDate: string,
  mealId: string | null,
  name: string,
  mealTime: string | null,
  description: string,
) {
  const { data, error } = await supabase.rpc('save_diet_meal', {
    p_academy_id: academyId,
    p_athlete_id: athleteId,
    p_plan_date: planDate,
    // Null = new meal / no time: valid for the function, typed as string by the generator.
    p_meal_id: mealId as string,
    p_name: name,
    p_meal_time: mealTime as string,
    p_description: description,
  });
  if (error) throw error;
  return data;
}

async function deleteMeal(id: string) {
  const { data, error } = await supabase.from('diet_plan_meals').delete().eq('id', id).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

async function copyDay(academyId: string, athleteId: string, fromDate: string, toDate: string) {
  const { data, error } = await supabase.rpc('copy_diet_day', {
    p_academy_id: academyId,
    p_athlete_id: athleteId,
    p_from_date: fromDate,
    p_to_date: toDate,
  });
  if (error) throw error;
  return data;
}

export const dietApi = { listDays, saveMeal, deleteMeal, copyDay };

export type DietDayRowApi = Awaited<ReturnType<typeof listDays>>[number];
