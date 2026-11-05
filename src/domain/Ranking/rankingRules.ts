import type { LocalDate } from '@domain/Classes/classesTypes';

export interface RankingEntry {
  position: number;
  userId: string;
  fullName: string;
  avatarPath: string | null;
  classes: number;
}

export interface MonthChampion {
  /** First day of the month. */
  month: LocalDate;
  userId: string;
  fullName: string;
  avatarPath: string | null;
  classes: number;
}

/** Rows shown before "…" (the viewer's own row is added below when further down). */
export const RANKING_TOP = 20;

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/** First day of the month of `date`. */
export function monthStart(date: LocalDate): LocalDate {
  return `${date.slice(0, 7)}-01`;
}

/** First day of the month `delta` months away. */
export function addMonths(month: LocalDate, delta: number): LocalDate {
  const [y, m] = month.split('-').map(Number);
  const index = y! * 12 + (m! - 1) + delta;
  const year = Math.floor(index / 12);
  return `${year}-${String((index % 12) + 1).padStart(2, '0')}-01`;
}

/** "Novembro de 2026" */
export function monthLabel(month: LocalDate): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m! - 1]} de ${y}`;
}

/** Champions grouped by month (ties share a month), newest first. */
export function championsByMonth(rows: MonthChampion[]): { month: LocalDate; champions: MonthChampion[] }[] {
  const groups = new Map<LocalDate, MonthChampion[]>();
  for (const row of rows) groups.set(row.month, [...(groups.get(row.month) ?? []), row]);
  return [...groups]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, champions]) => ({ month, champions }));
}

/**
 * What the list shows: the top rows and, when the viewer is further down, a
 * gap and their own row (so everybody sees where they stand).
 */
export function visibleRanking(
  entries: RankingEntry[],
  viewerId: string | undefined,
  top = RANKING_TOP,
): { rows: RankingEntry[]; own: RankingEntry | null } {
  const rows = entries.slice(0, top);
  const own = entries.find((e) => e.userId === viewerId) ?? null;
  return { rows, own: own && !rows.includes(own) ? own : null };
}

/** "1 aula", "12 aulas". */
export function classesLabel(n: number): string {
  return `${n} ${n === 1 ? 'aula' : 'aulas'}`;
}
