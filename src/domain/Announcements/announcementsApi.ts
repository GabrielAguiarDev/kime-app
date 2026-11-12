import { supabase } from '@infra/supabase';

/** Notices the caller sees, with the author (RPC; RLS decides the rows). Pinned first, newest first. */
async function listFeed(academyId: string) {
  const { data, error } = await supabase.rpc('academy_announcements_feed', { p_academy_id: academyId });
  if (error) throw error;
  return data;
}

type Row = { body: string; modality_id: string | null; pinned: boolean; expires_on: string | null };

async function create(academyId: string, row: Row) {
  const { error } = await supabase.from('academy_announcements').insert({ academy_id: academyId, ...row });
  if (error) throw error;
}

async function update(id: string, row: Row) {
  const { data, error } = await supabase.from('academy_announcements').update(row).eq('id', id).select('id');
  if (error) throw error;
  // RLS: only the author edits; no row back = not allowed.
  if (data.length === 0) throw new Error('forbidden');
}

async function remove(id: string) {
  const { data, error } = await supabase.from('academy_announcements').delete().eq('id', id).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

export type AnnouncementRowApi = Awaited<ReturnType<typeof listFeed>>[number];

export const announcementsApi = { listFeed, create, update, remove };
