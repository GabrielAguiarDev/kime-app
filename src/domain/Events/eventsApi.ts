import { supabase } from '@infra/supabase';
import type { Database } from '@infra/supabase';

export const COVER_BUCKET = 'academy-event-covers';

type RsvpStatusApi = Database['public']['Enums']['academy_event_rsvp_status'];

/** The generated RPC types mark every argument as required and non-null; SQL accepts null. */
const nullable = <T>(value: T | null): T => value as T;

const EVENT_COLUMNS =
  'id, academy_id, title, description, event_date, start_time, end_time, location, all_modalities, price_cents, capacity, rsvp_deadline, cover_path, created_by, cancelled_at, created_at, academy_event_modalities(modality_id)';

/** Staff: every event of the academy; a student: the events of their modalities and "all" (RLS). */
async function listEvents(academyId: string) {
  const { data, error } = await supabase
    .from('academy_events')
    .select(EVENT_COLUMNS)
    .eq('academy_id', academyId)
    .order('event_date')
    .order('start_time');
  if (error) throw error;
  return data;
}

/** Staff: every answer; a member: who is going to the events they see, plus their own answers (RLS). */
async function listRsvps(academyId: string) {
  const { data, error } = await supabase
    .from('academy_event_rsvps')
    .select('event_id, user_id, status')
    .eq('academy_id', academyId);
  if (error) throw error;
  return data;
}

async function listPeople(eventId: string) {
  const { data, error } = await supabase.rpc('academy_event_people', { p_event_id: eventId });
  if (error) throw error;
  return data;
}

async function saveEvent(args: {
  id: string | null;
  academyId: string;
  title: string;
  description: string | null;
  eventDate: string;
  startTime: string;
  endTime: string | null;
  location: string | null;
  modalityIds: string[];
  priceCents: number | null;
  capacity: number | null;
  rsvpDeadline: string | null;
  coverPath: string | null;
}) {
  const { data, error } = await supabase.rpc('save_academy_event', {
    p_event_id: nullable(args.id),
    p_academy_id: args.academyId,
    p_title: args.title,
    p_description: nullable(args.description),
    p_event_date: args.eventDate,
    p_start_time: args.startTime,
    p_end_time: nullable(args.endTime),
    p_location: nullable(args.location),
    p_modality_ids: args.modalityIds,
    p_price_cents: nullable(args.priceCents),
    p_capacity: nullable(args.capacity),
    p_rsvp_deadline: nullable(args.rsvpDeadline),
    p_cover_path: nullable(args.coverPath),
  });
  if (error) throw error;
  return data;
}

async function cancelEvent(id: string) {
  const { data, error } = await supabase
    .from('academy_events')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

/** Own answer: changes it when there is one, creates it otherwise. */
async function respond(academyId: string, eventId: string, userId: string, status: RsvpStatusApi) {
  const updated = await supabase
    .from('academy_event_rsvps')
    .update({ status })
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .select('event_id');
  if (updated.error) throw updated.error;
  if (updated.data.length > 0) return;
  const { error } = await supabase.from('academy_event_rsvps').insert({ academy_id: academyId, event_id: eventId, user_id: userId, status });
  if (error) throw error;
}

async function setMark(
  table: 'academy_event_attendance' | 'academy_event_payments',
  academyId: string,
  eventId: string,
  userIds: string[],
  on: boolean,
) {
  if (userIds.length === 0) return;
  if (on) {
    const { error } = await supabase.from(table).insert(userIds.map((userId) => ({ academy_id: academyId, event_id: eventId, user_id: userId })));
    if (error) throw error;
  } else {
    const { error } = await supabase.from(table).delete().eq('event_id', eventId).in('user_id', userIds);
    if (error) throw error;
  }
}

async function uploadCover(academyId: string, bytes: ArrayBuffer, contentType: string, extension: string) {
  const path = `${academyId}/cover-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(COVER_BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

async function removeCover(path: string) {
  const { error } = await supabase.storage.from(COVER_BUCKET).remove([path]);
  if (error) throw error;
}

/** Covers live in a public bucket: the URL is enough to show them. */
export function coverUrl(path: string | null | undefined): string | null {
  return path ? supabase.storage.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl : null;
}

export type EventRowApi = Awaited<ReturnType<typeof listEvents>>[number];
export type EventPersonRowApi = Awaited<ReturnType<typeof listPeople>>[number];

export const eventsApi = {
  listEvents,
  listRsvps,
  listPeople,
  saveEvent,
  cancelEvent,
  respond,
  setMark,
  uploadCover,
  removeCover,
};
