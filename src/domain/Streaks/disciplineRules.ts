import type { Discipline, DisciplineDay, DisciplineWater, DisciplineWeekState } from './disciplineTypes';

/** The rule as the database applies it (texts only; the database decides). */
export const DISCIPLINE_RULE = {
  /** Days with the water goal met in the week. */
  waterDays: 5,
  /** Classes confirmed by the professor in the week. */
  classes: 1,
  /** Done weeks in a row that earn a freeze. */
  earnEvery: 4,
  maxFreezes: 2,
} as const;

const WATER: DisciplineWater[] = ['unconfigured', 'progress', 'done', 'over'];
const WEEK: DisciplineWeekState[] = ['done', 'frozen', 'missed'];

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** my_discipline() JSON → Discipline. Unknown values fall back to the safe side. */
export function parseDiscipline(raw: unknown): Discipline | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const days = Array.isArray(r.days) ? r.days : [];
  const weeks = Array.isArray(r.weeks) ? r.weeks : [];
  return {
    today: str(r.today),
    weekStart: str(r.week_start),
    current: num(r.current),
    record: num(r.record),
    freezes: num(r.freezes),
    weekDone: r.week_done === true,
    days: days.map((d: Record<string, unknown>): DisciplineDay => ({
      day: str(d.day),
      water: WATER.includes(d.water as DisciplineWater) ? (d.water as DisciplineWater) : 'unconfigured',
      confirmed: num(d.confirmed),
      pending: num(d.pending),
    })),
    weeks: weeks.map((w: Record<string, unknown>) => ({
      weekStart: str(w.week_start),
      state: WEEK.includes(w.state as DisciplineWeekState) ? (w.state as DisciplineWeekState) : 'missed',
    })),
  };
}

/** This week so far: water days met and confirmed / pending classes. */
export function weekProgress(d: Pick<Discipline, 'days'>) {
  return {
    waterDays: d.days.filter((x) => x.water === 'done').length,
    classes: d.days.reduce((n, x) => n + x.confirmed, 0),
    pending: d.days.reduce((n, x) => n + x.pending, 0),
  };
}

/** "Água 3/5 · Treino 1/1" (each part capped at its target). */
export function weekProgressText(d: Pick<Discipline, 'days'>): string {
  const p = weekProgress(d);
  const water = Math.min(p.waterDays, DISCIPLINE_RULE.waterDays);
  const classes = Math.min(p.classes, DISCIPLINE_RULE.classes);
  return `Água ${water}/${DISCIPLINE_RULE.waterDays} · Treino ${classes}/${DISCIPLINE_RULE.classes}`;
}

/** "1 semana", "3 semanas". */
export function weeksLabel(count: number): string {
  return `${count} ${count === 1 ? 'semana' : 'semanas'}`;
}
