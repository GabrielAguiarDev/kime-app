import { supabase } from '@infra/supabase';

// ------------------------------------------------------------- team ---
async function inviteCompetitor(membershipId: string) {
  const { error } = await supabase.rpc('invite_competitor', { p_membership_id: membershipId });
  if (error) throw error;
}

async function respondInvite(membershipId: string, accept: boolean) {
  const { error } = await supabase.rpc('respond_competitor_invite', {
    p_membership_id: membershipId,
    p_accept: accept,
  });
  if (error) throw error;
}

async function removeCompetitor(membershipId: string) {
  const { error } = await supabase.rpc('remove_competitor', { p_membership_id: membershipId });
  if (error) throw error;
}

// ---------------------------------------------------- championships ---
/** Staff: every championship of the academy. Competitor: only the ones they are entered in (RLS). */
async function listChampionships(academyId: string) {
  const { data, error } = await supabase
    .from('championships')
    .select('id, academy_id, name, event_date, location')
    .eq('academy_id', academyId)
    .order('event_date');
  if (error) throw error;
  return data;
}

/** Championships the athlete is entered in, in every academy they compete for. */
async function listMyChampionships(athleteId: string) {
  const { data, error } = await supabase
    .from('championship_entries')
    .select('championship:championships!inner(id, academy_id, name, event_date, location)')
    .eq('athlete_id', athleteId);
  if (error) throw error;
  return data.map((row) => row.championship);
}

async function createChampionship(academyId: string, name: string, eventDate: string, location: string) {
  const { data, error } = await supabase
    .from('championships')
    .insert({ academy_id: academyId, name, event_date: eventDate, location })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function updateChampionship(id: string, name: string, eventDate: string, location: string) {
  const { data, error } = await supabase
    .from('championships')
    .update({ name, event_date: eventDate, location })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

async function deleteChampionship(id: string) {
  const { data, error } = await supabase.from('championships').delete().eq('id', id).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

async function listEntries(academyId: string) {
  const { data, error } = await supabase
    .from('championship_entries')
    .select('championship_id, athlete_id')
    .eq('academy_id', academyId);
  if (error) throw error;
  return data;
}

async function setEntries(championshipId: string, athleteIds: string[]) {
  const { error } = await supabase.rpc('set_championship_entries', {
    p_championship_id: championshipId,
    p_athlete_ids: athleteIds,
  });
  if (error) throw error;
}

// ------------------------------------------------------------ weight ---
async function listWeights(athleteId: string) {
  const { data, error } = await supabase
    .from('weight_logs')
    .select('id, logged_on, weight_kg')
    .eq('athlete_id', athleteId)
    .order('logged_on', { ascending: false })
    .limit(120);
  if (error) throw error;
  return data;
}

async function insertWeight(athleteId: string, loggedOn: string, weightKg: number) {
  const { error } = await supabase
    .from('weight_logs')
    .insert({ athlete_id: athleteId, logged_on: loggedOn, weight_kg: weightKg });
  if (error) throw error;
}

async function updateWeight(id: string, weightKg: number) {
  const { data, error } = await supabase.from('weight_logs').update({ weight_kg: weightKg }).eq('id', id).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

async function deleteWeight(id: string) {
  const { data, error } = await supabase.from('weight_logs').delete().eq('id', id).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

// ----------------------------------------------------- athlete water ---
/** Staff: water logs of a competitor since an instant (RLS: competitors of the caller's academy). */
async function listAthleteWater(athleteId: string, sinceIso: string) {
  const { data, error } = await supabase
    .from('water_logs')
    .select('id, amount_ml, logged_at')
    .eq('user_id', athleteId)
    .gte('logged_at', sinceIso)
    .order('logged_at');
  if (error) throw error;
  return data;
}

// -------------------------------------------------------- water plan ---
/** Plans of an athlete (every academy the caller can read), newest week first. */
async function listWaterPlans(athleteId: string) {
  const { data, error } = await supabase
    .from('water_plans')
    .select('id, academy_id, week_start, updated_at, days:water_plan_days(weekday, target_ml)')
    .eq('athlete_id', athleteId)
    .order('week_start', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

async function setWaterPlan(academyId: string, athleteId: string, targets: (number | null)[]) {
  const { error } = await supabase.rpc('set_water_plan', {
    p_academy_id: academyId,
    p_athlete_id: athleteId,
    // Nulls are valid array items for the RPC (no target that day).
    p_targets: targets as number[],
  });
  if (error) throw error;
}

export const competitionApi = {
  inviteCompetitor,
  respondInvite,
  removeCompetitor,
  listChampionships,
  listMyChampionships,
  createChampionship,
  updateChampionship,
  deleteChampionship,
  listEntries,
  setEntries,
  listWeights,
  insertWeight,
  updateWeight,
  deleteWeight,
  listWaterPlans,
  setWaterPlan,
  listAthleteWater,
};

export type ChampionshipRowApi = Awaited<ReturnType<typeof listChampionships>>[number];
export type WaterPlanRowApi = Awaited<ReturnType<typeof listWaterPlans>>[number];
