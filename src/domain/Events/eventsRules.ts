import { WEEKDAY_LABELS, weekdayOf } from '@domain/Classes/classesRules';
import type { LocalDate } from '@domain/Classes/classesTypes';
import { daysBetween } from '@domain/Competition/competitionRules';
import { zonedTime } from '@domain/Reminders/reminderRules';

import type { AcademyEvent, EventPerson, EventRsvp, RsvpStatus } from './eventsTypes';

export const EVENT_TITLE_MIN = 2;
export const EVENT_TITLE_MAX = 120;
export const EVENT_DESCRIPTION_MAX = 2000;
export const EVENT_LOCATION_MAX = 200;
export const EVENT_CAPACITY_MAX = 10000;
/** R$ 100.000,00 */
export const EVENT_PRICE_MAX_CENTS = 10_000_000;
/** Shown when the location is empty. */
export const DEFAULT_LOCATION = 'Na academia';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Postgres `time` ("19:00:00") → "19:00". */
export function toHourMinute(time: string): string {
  return time.slice(0, 5);
}

/** "R$ 40,00", "R$ 1.250,50" */
export function formatPrice(cents: number): string {
  const reais = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, '0');
  const grouped = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${grouped},${rest}`;
}

/** "Gratuito" or "R$ 40,00 · pagamento direto com a academia". */
export function priceLabel(cents: number | null): string {
  return cents === null ? 'Gratuito' : `${formatPrice(cents)} · pagamento direto com a academia`;
}

/**
 * Price typed in the form ("40", "40,5", "40,00", "1.250,00"). Empty = free
 * (null). `valid` is false for anything else, zero included.
 */
export function parsePrice(text: string): { valid: boolean; cents: number | null } {
  const raw = text.trim();
  if (!raw) return { valid: true, cents: null };
  const match = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(raw);
  if (!match) return { valid: false, cents: null };
  const reais = Number(match[1]!.replace(/\./g, ''));
  const cents = reais * 100 + Number((match[2] ?? '0').padEnd(2, '0'));
  if (cents <= 0 || cents > EVENT_PRICE_MAX_CENTS) return { valid: false, cents: null };
  return { valid: true, cents };
}

/** Cents → the form's text ("40,00"). */
export function priceToText(cents: number | null): string {
  return cents === null ? '' : formatPrice(cents).replace('R$ ', '');
}

/** Capacity typed in the form. Empty = no limit (null). */
export function parseCapacity(text: string): { valid: boolean; capacity: number | null } {
  const raw = text.trim();
  if (!raw) return { valid: true, capacity: null };
  if (!/^\d+$/.test(raw)) return { valid: false, capacity: null };
  const n = Number(raw);
  return n >= 1 && n <= EVENT_CAPACITY_MAX ? { valid: true, capacity: n } : { valid: false, capacity: null };
}

/** Typing helper: digits only, "1900" → "19:00". */
export function maskTime(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

/** `HH:MM` (00:00–23:59) or null. */
export function parseTime(text: string): string | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(text.trim());
  return match ? `${match[1]}:${match[2]}` : null;
}

/** "sáb, 15 nov" */
export function shortDateLabel(date: LocalDate): string {
  const [, m, d] = date.split('-').map(Number);
  return `${WEEKDAY_LABELS[weekdayOf(date)].short.toLowerCase()}, ${d} ${MONTHS[(m ?? 1) - 1]}`;
}

/** "19:00" or "19:00–23:00". */
export function timeRangeLabel(event: Pick<AcademyEvent, 'startTime' | 'endTime'>): string {
  return event.endTime ? `${event.startTime}–${event.endTime}` : event.startTime;
}

/** "sáb, 15 nov · 19:00–23:00" */
export function eventWhenLabel(event: Pick<AcademyEvent, 'eventDate' | 'startTime' | 'endTime'>): string {
  return `${shortDateLabel(event.eventDate)} · ${timeRangeLabel(event)}`;
}

/** "Hoje", "Amanhã", "Em 12 dias". */
export function eventCountdownLabel(today: LocalDate, date: LocalDate): string {
  const days = daysBetween(today, date);
  if (days <= 0) return 'Hoje';
  if (days === 1) return 'Amanhã';
  return `Em ${days} dias`;
}

export function locationLabel(location: string | null): string {
  return location?.trim() ? location.trim() : DEFAULT_LOCATION;
}

const byWhen = (a: AcademyEvent, b: AcademyEvent) =>
  a.eventDate.localeCompare(b.eventDate) || a.startTime.localeCompare(b.startTime) || a.title.localeCompare(b.title);

/** Not cancelled, from today on, nearest first. */
export function upcomingEvents(events: AcademyEvent[], today: LocalDate): AcademyEvent[] {
  return events.filter((e) => !e.cancelledAt && e.eventDate >= today).sort(byWhen);
}

/** Held (before today) or cancelled, newest first. */
export function pastOrCancelledEvents(events: AcademyEvent[], today: LocalDate): AcademyEvent[] {
  return events.filter((e) => !!e.cancelledAt || e.eventDate < today).sort((a, b) => byWhen(b, a));
}

/** Events of a day (agenda), not cancelled, by start time. */
export function eventsOn(events: AcademyEvent[], date: LocalDate): AcademyEvent[] {
  return events.filter((e) => !e.cancelledAt && e.eventDate === date).sort(byWhen);
}

/** The member may still answer: not cancelled and academy-local today ≤ deadline (or the event day). */
export function rsvpOpen(event: AcademyEvent, today: LocalDate): boolean {
  return !event.cancelledAt && today <= (event.rsvpDeadline ?? event.eventDate);
}

/** Staff mark attendance from the event day on (not cancelled). */
export function canMarkAttendance(event: AcademyEvent, today: LocalDate): boolean {
  return !event.cancelledAt && event.eventDate <= today;
}

export function goingCount(rsvps: EventRsvp[], eventId: string): number {
  return rsvps.filter((r) => r.eventId === eventId && r.status === 'going').length;
}

export function myStatus(rsvps: EventRsvp[], eventId: string, userId: string | undefined): RsvpStatus | null {
  return rsvps.find((r) => r.eventId === eventId && r.userId === userId)?.status ?? null;
}

/** Spots left (never negative), or null without a limit. */
export function spotsLeft(event: Pick<AcademyEvent, 'capacity'>, going: number): number | null {
  return event.capacity === null ? null : Math.max(0, event.capacity - going);
}

/** "Vou" is unavailable: full, unless the person already goes. */
export function isFullFor(event: Pick<AcademyEvent, 'capacity'>, going: number, mine: RsvpStatus | null): boolean {
  return mine !== 'going' && spotsLeft(event, going) === 0;
}

/** "1 vaga restante", "12 vagas restantes", "Vagas esgotadas". */
export function spotsLabel(left: number): string {
  if (left <= 0) return 'Vagas esgotadas';
  return left === 1 ? '1 vaga restante' : `${left} vagas restantes`;
}

/** "1 vai", "12 vão". */
export function goingLabel(n: number): string {
  return n === 1 ? '1 vai' : `${n} vão`;
}

/** The event is meant for the modality (all, or listed). */
export function isForModality(event: AcademyEvent, modalityId: string | undefined): boolean {
  return event.allModalities || (!!modalityId && event.modalityIds.includes(modalityId));
}

/** Staff lists: going, not going and no answer, each by name. */
export function groupPeople(people: EventPerson[]): { going: EventPerson[]; notGoing: EventPerson[]; noAnswer: EventPerson[] } {
  const byName = (a: EventPerson, b: EventPerson) => a.fullName.localeCompare(b.fullName, 'pt-BR');
  return {
    going: people.filter((p) => p.status === 'going').sort(byName),
    notGoing: people.filter((p) => p.status === 'not_going').sort(byName),
    noAnswer: people.filter((p) => p.status === null).sort(byName),
  };
}

/**
 * Money of a paid event (staff): received = people marked as paid × price
 * (whatever their answer); expected = people going × price.
 */
export function eventRevenue(
  priceCents: number,
  people: Pick<EventPerson, 'status' | 'paid'>[],
): { paidCount: number; goingCount: number; receivedCents: number; expectedCents: number } {
  const paidCount = people.filter((p) => p.paid).length;
  const goingCount = people.filter((p) => p.status === 'going').length;
  return { paidCount, goingCount, receivedCents: paidCount * priceCents, expectedCents: goingCount * priceCents };
}

// ------------------------------------------------------- local notices ---
/** Reminders the day before, at this academy time. */
export const EVENT_REMINDER_TIME = '18:00';
/** iOS keeps 64 pending notifications per app; class reminders take most of them. */
export const MAX_EVENT_REMINDERS = 4;

export interface EventReminder {
  key: string;
  eventId: string;
  at: Date;
  title: string;
  body: string;
}

/** The day before a local date. */
function dayBefore(date: LocalDate): LocalDate {
  const t = Date.parse(`${date}T00:00:00Z`) - 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * "Amanhã tem evento" the day before at 18:00 (academy time), for the events
 * the person is going to that are still ahead of `now`. Nearest first, capped.
 */
export function planEventReminders({
  events,
  goingIds,
  timeZone,
  now,
  max = MAX_EVENT_REMINDERS,
}: {
  events: AcademyEvent[];
  goingIds: Set<string>;
  timeZone: string;
  now: Date;
  max?: number;
}): EventReminder[] {
  return events
    .filter((e) => !e.cancelledAt && goingIds.has(e.id))
    .sort(byWhen)
    .map((e) => ({
      key: `${e.id}:${e.eventDate}:${e.startTime}`,
      eventId: e.id,
      at: zonedTime(dayBefore(e.eventDate), EVENT_REMINDER_TIME, timeZone),
      title: 'Evento amanhã',
      body: `${e.title} às ${e.startTime} · ${locationLabel(e.location)}.`,
    }))
    .filter((r) => r.at.getTime() > now.getTime())
    .slice(0, max);
}

export interface EventNoticeState {
  seen: string[];
  cancelled: string[];
}

export interface EventNotice {
  eventId: string;
  title: string;
  body: string;
}

/**
 * Local "new event" / "event cancelled" notices, worked out when the app
 * opens or comes back (no push yet). The first run only records what exists.
 * New: upcoming, not cancelled, not created by the person. Cancelled: only to
 * whoever was going.
 */
export function eventNotices({
  events,
  previous,
  userId,
  goingIds,
  today,
}: {
  events: AcademyEvent[];
  previous: EventNoticeState | null;
  userId: string;
  goingIds: Set<string>;
  today: LocalDate;
}): { notices: EventNotice[]; next: EventNoticeState } {
  const next: EventNoticeState = {
    seen: events.map((e) => e.id),
    cancelled: events.filter((e) => !!e.cancelledAt).map((e) => e.id),
  };
  if (!previous) return { notices: [], next };
  const seen = new Set(previous.seen);
  const cancelled = new Set(previous.cancelled);
  const notices: EventNotice[] = [];
  for (const e of [...events].sort(byWhen)) {
    if (!seen.has(e.id) && !e.cancelledAt && e.eventDate >= today && e.createdBy !== userId) {
      notices.push({
        eventId: e.id,
        title: `Novo evento: ${e.title}`,
        body: `${eventWhenLabel(e)} · ${locationLabel(e.location)}. Confirme sua presença.`,
      });
    }
    if (e.cancelledAt && !cancelled.has(e.id) && seen.has(e.id) && goingIds.has(e.id) && e.eventDate >= today) {
      notices.push({
        eventId: e.id,
        title: 'Evento cancelado',
        body: `${e.title} (${shortDateLabel(e.eventDate)}) foi cancelado pela academia.`,
      });
    }
  }
  return { notices, next };
}
