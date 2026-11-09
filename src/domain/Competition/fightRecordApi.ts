import { supabase, type TablesInsert } from '@infra/supabase';

import type { FightInput, Placement, PreviousChampionshipInput, PreviousRecord } from './fightRecordTypes';

const FIGHT_COLUMNS = 'id, result, method, stage, opponent_name, note, created_at';

/** Staff: entries of a championship with placement and fights (RLS: staff of the academy). */
async function listEntryResults(championshipId: string) {
  const { data, error } = await supabase
    .from('championship_entries')
    .select(`id, athlete_id, placement, fights:championship_fights(${FIGHT_COLUMNS})`)
    .eq('championship_id', championshipId);
  if (error) throw error;
  return data;
}

/** Staff, from the championship day on (RLS). Zero rows means it did not apply. */
async function setPlacement(entryId: string, placement: Placement | null) {
  const { data, error } = await supabase
    .from('championship_entries')
    .update({ placement })
    .eq('id', entryId)
    .select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

const toRow = (input: FightInput) => ({
  result: input.result,
  method: input.method,
  stage: input.stage,
  opponent_name: input.opponentName,
  note: input.note,
});

async function addFight(entryId: string, input: FightInput) {
  // academy, athlete and "recorded by" are filled by the database (trigger).
  const row = { entry_id: entryId, ...toRow(input) } as TablesInsert<'championship_fights'>;
  const { error } = await supabase.from('championship_fights').insert(row);
  if (error) throw error;
}

async function updateFight(id: string, input: FightInput) {
  const { data, error } = await supabase.from('championship_fights').update(toRow(input)).eq('id', id).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

async function deleteFight(id: string) {
  const { data, error } = await supabase.from('championship_fights').delete().eq('id', id).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

/** The athlete themself or staff: held championships with placement and fights. */
async function history(academyId: string, athleteId: string) {
  const { data, error } = await supabase.rpc('athlete_fight_history', {
    p_academy_id: academyId,
    p_athlete_id: athleteId,
  });
  if (error) throw error;
  return data;
}

/** Record per modality (classmates: only the modalities in common). */
async function summary(academyId: string, athleteId: string) {
  const { data, error } = await supabase.rpc('fight_record_summary', {
    p_academy_id: academyId,
    p_athlete_id: athleteId,
  });
  if (error) throw error;
  return data;
}

// ------------------------------------------------ history before the app ---
/** Previous record per modality ("Antes do Kimi"): staff of the academy or the athlete (RLS). */
async function previousRecords(academyId: string, athleteId: string) {
  const { data, error } = await supabase
    .from('athlete_previous_records')
    .select('modality_id, wins, losses, draws, gold, silver, bronze')
    .eq('academy_id', academyId)
    .eq('athlete_id', athleteId);
  if (error) throw error;
  return data;
}

/** Staff: sets the previous record of a modality (all zeros removes it). */
async function setPreviousRecord(academyId: string, athleteId: string, record: PreviousRecord) {
  const { error } = await supabase.rpc('set_previous_record', {
    p_academy_id: academyId,
    p_athlete_id: athleteId,
    p_modality_id: record.modalityId,
    p_wins: record.wins,
    p_losses: record.losses,
    p_draws: record.draws,
    p_gold: record.gold,
    p_silver: record.silver,
    p_bronze: record.bronze,
  });
  if (error) throw error;
}

/** Staff: a previous championship of one athlete, with their entry. Returns its id. */
async function createPreviousChampionship(academyId: string, athleteId: string, input: PreviousChampionshipInput) {
  const { data, error } = await supabase.rpc('create_previous_championship', {
    p_academy_id: academyId,
    p_athlete_id: athleteId,
    p_modality_id: input.modalityId,
    p_name: input.name,
    p_event_date: input.eventDate,
    p_location: input.location,
  });
  if (error) throw error;
  return data;
}

export const fightRecordApi = {
  listEntryResults,
  setPlacement,
  addFight,
  updateFight,
  deleteFight,
  history,
  summary,
  previousRecords,
  setPreviousRecord,
  createPreviousChampionship,
};

export type FightRowApi = Awaited<ReturnType<typeof listEntryResults>>[number]['fights'][number];
