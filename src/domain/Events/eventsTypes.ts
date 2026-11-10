import type { BeltLook, LocalDate } from '@domain/Classes';
import type { MembershipRole } from '@domain/Membership';

export type RsvpStatus = 'going' | 'not_going';

/**
 * An academy event (not a class: never counts for check-ins, belts, streaks or
 * ranking). Date and times are in the academy calendar.
 */
export interface AcademyEvent {
  id: string;
  academyId: string;
  title: string;
  description: string | null;
  eventDate: LocalDate;
  /** `HH:MM` */
  startTime: string;
  /** `HH:MM`; earlier than the start = past midnight. */
  endTime: string | null;
  /** Null = "Na academia". */
  location: string | null;
  allModalities: boolean;
  /** Empty when `allModalities`. */
  modalityIds: string[];
  /** Null = free. */
  priceCents: number | null;
  capacity: number | null;
  /** Last day to answer; null = until the event day. */
  rsvpDeadline: LocalDate | null;
  coverPath: string | null;
  createdBy: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

/** Form values (create / edit). `modalityIds` empty = all modalities. */
export interface EventInput {
  title: string;
  description: string;
  eventDate: LocalDate;
  startTime: string;
  endTime: string | null;
  location: string | null;
  modalityIds: string[];
  priceCents: number | null;
  capacity: number | null;
  rsvpDeadline: LocalDate | null;
  /** New cover picked on the device (uploaded on save); undefined keeps the current one, null removes it. */
  coverUri?: string | null;
}

/** An answer visible to the caller (staff: all; member: who is going + their own). */
export interface EventRsvp {
  eventId: string;
  userId: string;
  status: RsvpStatus;
}

/** A person of the event's audience (academy_event_people). */
export interface EventPerson {
  userId: string;
  fullName: string;
  avatarPath: string | null;
  role: MembershipRole;
  belt: BeltLook | null;
  status: RsvpStatus | null;
  respondedAt: string | null;
  /** Staff (or the person themself) only; null otherwise. */
  attended: boolean | null;
  paid: boolean | null;
}
