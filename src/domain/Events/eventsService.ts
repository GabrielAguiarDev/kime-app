import type { BeltColorKey } from '@domain/Classes';
import { toAppError } from '@infra/supabase';
import { prepareCoverImage } from '@utils/coverImage';

import { eventsApi as api, type EventPersonRowApi, type EventRowApi } from './eventsApi';
import { toHourMinute } from './eventsRules';
import type { AcademyEvent, EventInput, EventPerson, EventRsvp, RsvpStatus } from './eventsTypes';

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    throw toAppError(e);
  }
}

function toEvent(row: EventRowApi): AcademyEvent {
  return {
    id: row.id,
    academyId: row.academy_id,
    title: row.title,
    description: row.description,
    eventDate: row.event_date,
    startTime: toHourMinute(row.start_time),
    endTime: row.end_time ? toHourMinute(row.end_time) : null,
    location: row.location,
    allModalities: row.all_modalities,
    modalityIds: (row.academy_event_modalities ?? []).map((m) => m.modality_id),
    priceCents: row.price_cents,
    capacity: row.capacity,
    rsvpDeadline: row.rsvp_deadline,
    coverPath: row.cover_path,
    createdBy: row.created_by,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
  };
}

function toPerson(row: EventPersonRowApi): EventPerson {
  return {
    userId: row.user_id,
    fullName: row.full_name,
    avatarPath: row.avatar_path,
    role: row.role,
    belt: row.belt_primary
      ? { primary: row.belt_primary as BeltColorKey, tip: (row.belt_tip ?? null) as BeltColorKey | null }
      : null,
    status: row.status ?? null,
    respondedAt: row.responded_at ?? null,
    attended: row.attended ?? null,
    paid: row.paid ?? null,
  };
}

/**
 * Create or edit. A new cover is uploaded first (a new file each time, no
 * stale CDN copy); the old one is removed after the save (best effort). A
 * failed save removes the file it just uploaded.
 */
async function saveEvent(academyId: string, id: string | null, input: EventInput, previousCover: string | null): Promise<string> {
  let coverPath = previousCover;
  let uploaded: string | null = null;
  if (input.coverUri) {
    const { bytes, contentType, extension } = await prepareCoverImage(input.coverUri);
    uploaded = await api.uploadCover(academyId, bytes, contentType, extension);
    coverPath = uploaded;
  } else if (input.coverUri === null) {
    coverPath = null;
  }
  let eventId: string;
  try {
    eventId = await api.saveEvent({
      id,
      academyId,
      title: input.title.trim(),
      description: input.description.trim() || null,
      eventDate: input.eventDate,
      startTime: input.startTime,
      endTime: input.endTime,
      location: input.location?.trim() || null,
      modalityIds: input.modalityIds,
      priceCents: input.priceCents,
      capacity: input.capacity,
      rsvpDeadline: input.rsvpDeadline,
      coverPath,
    });
  } catch (e) {
    if (uploaded) await api.removeCover(uploaded).catch(() => undefined);
    throw e;
  }
  if (previousCover && previousCover !== coverPath) await api.removeCover(previousCover).catch(() => undefined);
  return eventId;
}

export const eventsService = {
  listEvents: (academyId: string): Promise<AcademyEvent[]> => call(async () => (await api.listEvents(academyId)).map(toEvent)),
  listRsvps: (academyId: string): Promise<EventRsvp[]> =>
    call(async () =>
      (await api.listRsvps(academyId)).map((r) => ({ eventId: r.event_id, userId: r.user_id, status: r.status })),
    ),
  listPeople: (eventId: string): Promise<EventPerson[]> => call(async () => (await api.listPeople(eventId)).map(toPerson)),
  saveEvent: (academyId: string, id: string | null, input: EventInput, previousCover: string | null) =>
    call(() => saveEvent(academyId, id, input, previousCover)),
  cancelEvent: (id: string) => call(() => api.cancelEvent(id)),
  respond: (academyId: string, eventId: string, userId: string, status: RsvpStatus) =>
    call(() => api.respond(academyId, eventId, userId, status)),
  setAttendance: (academyId: string, eventId: string, userIds: string[], on: boolean) =>
    call(() => api.setMark('academy_event_attendance', academyId, eventId, userIds, on)),
  setPaid: (academyId: string, eventId: string, userIds: string[], on: boolean) =>
    call(() => api.setMark('academy_event_payments', academyId, eventId, userIds, on)),
};
