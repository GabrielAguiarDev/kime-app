import { addDays, classesOn } from './classesRules';
import type { Checkin, ClassSchedule, LocalDate } from './classesTypes';

/**
 * Classes have a start time but no length: a class counts as "em andamento"
 * for this long after it starts (decision for the staff Início).
 */
export const CLASS_LENGTH_MIN = 60;

export function attendanceCounts(checkins: Pick<Checkin, 'scheduleId' | 'status'>[], scheduleId: string) {
  let confirmed = 0;
  let pending = 0;
  for (const c of checkins) {
    if (c.scheduleId !== scheduleId) continue;
    if (c.status === 'confirmed') confirmed += 1;
    else if (c.status === 'pending') pending += 1;
  }
  return { confirmed, pending };
}

/** `HH:MM` → minutes since midnight. */
export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export interface NextClass {
  schedule: ClassSchedule;
  date: LocalDate;
  /** live: started less than CLASS_LENGTH_MIN ago; soon: later today; later: another day this week. */
  status: 'live' | 'soon' | 'later';
  /** Minutes until it starts (0 when live; days ahead count as full days). */
  minutesUntil: number;
}

/**
 * The class to highlight on the staff Início: the one in progress or the next
 * one today; without any left today, the next one in the coming 7 days.
 */
export function nextClass(schedules: ClassSchedule[], today: LocalDate, nowTime: string): NextClass | null {
  const now = minutesOf(nowTime);
  for (const s of classesOn(schedules, today)) {
    const start = minutesOf(s.startTime);
    if (now >= start && now < start + CLASS_LENGTH_MIN) return { schedule: s, date: today, status: 'live', minutesUntil: 0 };
    if (start > now) return { schedule: s, date: today, status: 'soon', minutesUntil: start - now };
  }
  for (let i = 1; i <= 7; i++) {
    const date = addDays(today, i);
    const first = classesOn(schedules, date)[0];
    if (first) {
      return { schedule: first, date, status: 'later', minutesUntil: i * 1440 - now + minutesOf(first.startTime) };
    }
  }
  return null;
}

/** "começa em 40 min", "começa em 1 h 15 min", "em andamento". */
export function startsInLabel(next: Pick<NextClass, 'status' | 'minutesUntil'>): string {
  if (next.status === 'live') return 'Em andamento';
  const m = next.minutesUntil;
  if (m < 60) return `Começa em ${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `Começa em ${h} h ${rest} min` : `Começa em ${h} h`;
}

const timeFormatters = new Map<string, Intl.DateTimeFormat>();

/** Current `HH:MM` in the academy time zone. */
export function nowTimeIn(timeZone: string, at = new Date()): string {
  let f = timeFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    timeFormatters.set(timeZone, f);
  }
  return f.format(at);
}
