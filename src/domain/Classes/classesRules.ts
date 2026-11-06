import type {
  BeltColorKey,
  BeltLook,
  Checkin,
  ClassSchedule,
  LocalDate,
  Modality,
  ModalityBelt,
  ModalityStats,
  Weekday,
} from './classesTypes';

// ----------------------------------------------------------------- dates ---
// Local dates are plain `YYYY-MM-DD` strings in the academy timezone (the
// server tells "today"); math is done in UTC so the device timezone never
// shifts a day.

function toUtc(date: LocalDate): Date {
  const [y = NaN, m = NaN, d = NaN] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): LocalDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

export function weekdayOf(date: LocalDate): Weekday {
  return toUtc(date).getUTCDay() as Weekday;
}

/** Monday of the week (weeks run Monday–Sunday). */
export function weekStart(date: LocalDate): LocalDate {
  const dow = weekdayOf(date);
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

export const WEEKDAY_LABELS: Record<Weekday, { short: string; long: string }> = {
  0: { short: 'Dom', long: 'Domingo' },
  1: { short: 'Seg', long: 'Segunda' },
  2: { short: 'Ter', long: 'Terça' },
  3: { short: 'Qua', long: 'Quarta' },
  4: { short: 'Qui', long: 'Quinta' },
  5: { short: 'Sex', long: 'Sexta' },
  6: { short: 'Sáb', long: 'Sábado' },
};

/** Monday first, as the week is shown in the app. */
export const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

/** `HH:MM` 24h. */
export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

// --------------------------------------------------------------- streak ---

/**
 * Weekly streak: consecutive weeks with at least one CONFIRMED class. The
 * current week does not break the streak while it has no class yet (the
 * student may still train this week): counting starts at the current week if
 * it has a class, otherwise at the previous one.
 */
export function weeklyStreak(confirmedDates: LocalDate[], today: LocalDate): number {
  const weeks = new Set(confirmedDates.map(weekStart));
  let cursor = weekStart(today);
  if (!weeks.has(cursor)) cursor = addDays(cursor, -7);
  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -7);
  }
  return streak;
}

/** Weekly streak from the student's check-ins: only CONFIRMED ones count. */
export function checkinStreak(checkins: Pick<Checkin, 'classDate' | 'status'>[], today: LocalDate): number {
  return weeklyStreak(
    checkins.filter((c) => c.status === 'confirmed').map((c) => c.classDate),
    today,
  );
}

// ----------------------------------------------------------- milestones ---

/** 10, 25, 50, 100, then every 100. */
export function isClassMilestone(total: number): boolean {
  return total === 10 || total === 25 || total === 50 || (total >= 100 && total % 100 === 0);
}

/** Next milestone after `total` (10, 25, 50, 100, then every 100). */
export function nextClassMilestone(total: number): number {
  for (const m of [10, 25, 50]) if (total < m) return m;
  return (Math.floor(total / 100) + 1) * 100;
}

/** Highest milestone reached when the total went from `previous` to `current`, if any. */
export function milestoneCrossed(previous: number, current: number): number | null {
  for (let n = current; n > previous; n--) {
    if (isClassMilestone(n)) return n;
  }
  return null;
}

// -------------------------------------------------------- belt progress ---

export interface BeltProgress {
  /** The belt being worked toward; null when there is no next belt. */
  next: ModalityBelt | null;
  done: number;
  required: number;
}

/** Belts of one modality in their order. */
export function beltsOf(belts: ModalityBelt[], modalityId: string): ModalityBelt[] {
  return belts.filter((b) => b.modalityId === modalityId).sort((a, b) => a.position - b.position);
}

/**
 * Next belt = the one right after the current (the first belt when the
 * student has none). Progress counts confirmed classes IN THAT MODALITY since
 * the last graduation in it (all of them before the first belt). `required`
 * is 0 when the next belt has no number of classes yet.
 */
export function beltProgress(
  modalityBelts: ModalityBelt[],
  currentBeltId: string | null,
  sinceBelt: number,
): BeltProgress {
  const ordered = [...modalityBelts].sort((a, b) => a.position - b.position);
  const index = currentBeltId ? ordered.findIndex((b) => b.id === currentBeltId) : -1;
  const next = ordered[index + 1] ?? null;
  const required = next?.classesRequired ?? 0;
  return { next, done: Math.min(sinceBelt, required), required };
}

/**
 * Modalities a student trains: a confirmed class or a belt in it. When there
 * is none yet, every modality of the academy (the student still sees the
 * trails before the first class).
 */
export function trainedModalities(modalities: Modality[], stats: ModalityStats[]): Modality[] {
  const trained = modalities.filter((m) =>
    stats.some((s) => s.modalityId === m.id && (s.confirmedTotal > 0 || !!s.beltId)),
  );
  return trained.length > 0 ? trained : modalities;
}

/** The most recently awarded belt across modalities (top bar color), if any. */
export function latestBelt(stats: ModalityStats[], belts: ModalityBelt[]): ModalityBelt | null {
  let latest: ModalityStats | null = null;
  for (const s of stats) {
    if (!s.beltId || !s.beltAwardedAt) continue;
    if (!latest || Date.parse(s.beltAwardedAt) > Date.parse(latest.beltAwardedAt!)) latest = s;
  }
  return latest ? (belts.find((b) => b.id === latest!.beltId) ?? null) : null;
}

// ---------------------------------------------------------- belt colors ---

/** Main palette, in order (DESIGN-SYSTEM.md 2.4): the grid shown first. */
export const BELT_COLOR_KEYS: BeltColorKey[] = [
  'white',
  'gray',
  'yellow',
  'orange',
  'green',
  'blue',
  'purple',
  'brown',
  'black',
  'red',
];

/** Light/dark shades (DESIGN-SYSTEM.md 2.4, variações). */
export const BELT_EXTRA_COLOR_KEYS: BeltColorKey[] = [
  'light_gray',
  'dark_gray',
  'dark_yellow',
  'light_green',
  'dark_green',
  'light_blue',
  'dark_blue',
  'light_purple',
  'light_brown',
  'dark_red',
];

/** Every belt color as the belt sheet shows it: grouped by family (neutrals, warm, cool). */
export const BELT_PICKER_ORDER: BeltColorKey[] = [
  'white',
  'light_gray',
  'gray',
  'dark_gray',
  'black',
  'light_brown',
  'brown',
  'yellow',
  'dark_yellow',
  'orange',
  'red',
  'dark_red',
  'light_purple',
  'purple',
  'light_green',
  'green',
  'dark_green',
  'light_blue',
  'blue',
  'dark_blue',
];

/** Belt names are always feminine ("faixa …"). */
export const BELT_COLOR_LABEL: Record<BeltColorKey, string> = {
  white: 'Branca',
  gray: 'Cinza',
  yellow: 'Amarela',
  orange: 'Laranja',
  green: 'Verde',
  blue: 'Azul',
  purple: 'Roxa',
  brown: 'Marrom',
  black: 'Preta',
  red: 'Vermelha',
  light_gray: 'Cinza-clara',
  dark_gray: 'Cinza-escura',
  dark_yellow: 'Amarela-escura',
  light_green: 'Verde-clara',
  dark_green: 'Verde-escura',
  light_blue: 'Azul-clara',
  dark_blue: 'Azul-escura',
  light_purple: 'Roxa-clara',
  light_brown: 'Marrom-clara',
  dark_red: 'Vermelha-escura',
};

export function isBeltColorKey(value: string | null | undefined): value is BeltColorKey {
  return !!value && ([...BELT_COLOR_KEYS, ...BELT_EXTRA_COLOR_KEYS] as string[]).includes(value);
}

/** "Vermelha" / "Vermelha/ponta preta". */
export function beltName(belt: BeltLook): string {
  const main = BELT_COLOR_LABEL[belt.primary];
  return belt.tip ? `${main}/ponta ${BELT_COLOR_LABEL[belt.tip].toLowerCase()}` : main;
}

export function sameBeltLook(a: BeltLook, b: BeltLook): boolean {
  return a.primary === b.primary && (a.tip ?? null) === (b.tip ?? null);
}

/** White always gets the `border` outline; black too (the app is dark only). */
export function beltColorNeedsOutline(key: BeltColorKey): boolean {
  return key === 'white' || key === 'black';
}

/** Light colors need dark text/icons on top of them (achievement header, selected check). */
const LIGHT_BELT_COLORS: BeltColorKey[] = [
  'white',
  'yellow',
  'gray',
  'light_gray',
  'dark_yellow',
  'light_green',
  'light_blue',
  'light_purple',
];

export function beltColorIsLight(key: BeltColorKey): boolean {
  return LIGHT_BELT_COLORS.includes(key);
}

export function beltNeedsDarkText(belt: BeltLook): boolean {
  return beltColorIsLight(belt.primary);
}

/** Classes per node of the graduation trail (11.2): "Aulas 21–30". */
export const TRAIL_BLOCK = 10;

export type TrailNodeState = 'done' | 'current' | 'future';

export interface TrailNode {
  /** 1-based class numbers covered by the node. */
  from: number;
  to: number;
  state: TrailNodeState;
  /** Classes done inside this node. */
  doneInNode: number;
}

/** Splits the classes required for the next belt into blocks of TRAIL_BLOCK. */
export function trailNodes(required: number, done: number, block = TRAIL_BLOCK): TrailNode[] {
  const nodes: TrailNode[] = [];
  for (let from = 1; from <= required; from += block) {
    const to = Math.min(from + block - 1, required);
    const doneInNode = Math.max(0, Math.min(done - (from - 1), to - from + 1));
    const state: TrailNodeState = done >= to ? 'done' : done >= from - 1 ? 'current' : 'future';
    nodes.push({ from, to, state, doneInNode });
  }
  return nodes;
}

// ----------------------------------------------------------- modalities ---

/** Suggestions when creating an academy; the academy keeps its own list. */
export const SUGGESTED_MODALITIES = ['Jiu-Jitsu', 'No-Gi', 'Muay Thai', 'Judô', 'Boxe', 'MMA', 'Wrestling', 'Karatê'];

/** Case-insensitive, trimmed comparison for modality names. */
export function sameModality(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR');
}

// -------------------------------------------------------------- classes ---

export function sortByTime(schedules: ClassSchedule[]): ClassSchedule[] {
  return [...schedules].sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** Active classes of the academy-local `date`, by start time. */
export function classesOn(schedules: ClassSchedule[], date: LocalDate): ClassSchedule[] {
  const dow = weekdayOf(date);
  return sortByTime(schedules.filter((s) => s.active && s.weekday === dow));
}
