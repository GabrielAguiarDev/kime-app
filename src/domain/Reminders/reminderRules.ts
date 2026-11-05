import { addDays, classesOn } from '@domain/Classes/classesRules';
import type { ClassSchedule, LocalDate } from '@domain/Classes/classesTypes';

/** Reminder lead time: 1 h before the class (user decision). */
export const REMINDER_LEAD_MS = 60 * 60 * 1000;
/** Days ahead scheduled at a time (re-planned whenever the app opens). */
export const REMINDER_DAYS = 7;
/** iOS keeps at most 64 pending local notifications: stay well below. */
export const MAX_REMINDERS = 50;

export interface ClassReminder {
  /** Stable per class occurrence: `${scheduleId}:${date}`. */
  key: string;
  /** When the notification fires. */
  at: Date;
  title: string;
  body: string;
}

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

/** Offset (ms) of `timeZone` from UTC at `instant`. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  let fmt = offsetFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    offsetFormatters.set(timeZone, fmt);
  }
  const parts = Object.fromEntries(fmt.formatToParts(new Date(instant)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** The instant of a wall-clock date + `HH:MM` in `timeZone` (whatever the device's zone). */
export function zonedTime(date: LocalDate, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const wall = Date.UTC(y!, m! - 1, d!, hh!, mm!);
  let instant = wall - zoneOffsetMs(wall, timeZone);
  // Second pass: right across a DST change.
  instant = wall - zoneOffsetMs(instant, timeZone);
  return new Date(instant);
}

/**
 * Reminders for the classes of the next days (academy calendar), 1 h before
 * each one, only the ones still ahead of `now`. `modalityIds` limits them to
 * the modalities the student trains (null = every class).
 */
export function planClassReminders({
  schedules,
  today,
  timeZone,
  academyName,
  modalityIds,
  now,
}: {
  schedules: ClassSchedule[];
  today: LocalDate;
  timeZone: string;
  academyName: string;
  modalityIds: Set<string> | null;
  now: Date;
}): ClassReminder[] {
  const out: ClassReminder[] = [];
  for (let i = 0; i < REMINDER_DAYS; i++) {
    const date = addDays(today, i);
    for (const s of classesOn(schedules, date)) {
      if (modalityIds && !modalityIds.has(s.modalityId)) continue;
      const at = new Date(zonedTime(date, s.startTime, timeZone).getTime() - REMINDER_LEAD_MS);
      if (at <= now) continue;
      out.push({
        key: `${s.id}:${date}`,
        at,
        title: 'Aula em 1 hora',
        body: `${s.modality} às ${s.startTime} na ${academyName}.`,
      });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_REMINDERS);
}

/** Fingerprint of a plan: unchanged plan = nothing to reschedule. */
export function planSignature(reminders: ClassReminder[]): string {
  return reminders.map((r) => `${r.key}@${r.at.getTime()}|${r.body}`).join(';');
}
