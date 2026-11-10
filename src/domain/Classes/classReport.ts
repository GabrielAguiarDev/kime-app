
import { weeklyAverage } from './classesRules';
import type { ClassReport, LocalDate, ModalityBelt } from './classesTypes';

/**
 * Views of the training report (Relatório de treinos) built from the raw
 * class_report numbers. `modalityId` null = every modality ("Todas").
 */

const DAY_MS = 86_400_000;

/** Days from `from` to `to`, both LocalDates, inclusive. */
function daysInclusive(from: LocalDate, to: LocalDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

const inModality = (modalityId: string | null) => (row: { modalityId: string | null }) =>
  modalityId === null || row.modalityId === modalityId;

/** Confirmed classes (all modalities or one). */
export function reportTotal(report: ClassReport, modalityId: string | null): number {
  return report.modalities.filter(inModality(modalityId)).reduce((a, m) => a + m.total, 0);
}

/** Confirmed classes per week over the last 3 months (or since joining). */
export function reportWeeklyAverage(report: ClassReport, modalityId: string | null): number {
  const recent = report.modalities.filter(inModality(modalityId)).reduce((a, m) => a + m.recent, 0);
  return weeklyAverage(recent, Math.max(1, daysInclusive(report.recentSince, report.today)));
}

export interface MonthCount {
  /** First day of the month. */
  month: LocalDate;
  classes: number;
}

/** First day of the month `back` months before the month of `date`. */
function monthBefore(date: LocalDate, back: number): LocalDate {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1 - back;
  const y = year + Math.floor(month / 12);
  const m = ((month % 12) + 12) % 12;
  return `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

/** Classes per month in the last `count` months (oldest first, the current month last). */
export function monthlySeries(report: ClassReport, modalityId: string | null, count = 12): MonthCount[] {
  const rows = report.months.filter(inModality(modalityId));
  return Array.from({ length: count }, (_, i) => {
    const month = monthBefore(report.today, count - 1 - i);
    return { month, classes: rows.filter((r) => r.month === month).reduce((a, r) => a + r.classes, 0) };
  });
}

/** The month with the most classes ever (all modalities; ties: the latest). */
export function bestMonth(report: ClassReport): MonthCount | null {
  const totals = new Map<LocalDate, number>();
  for (const r of report.months) totals.set(r.month, (totals.get(r.month) ?? 0) + r.classes);
  let best: MonthCount | null = null;
  for (const [month, classes] of totals) {
    if (classes > 0 && (!best || classes > best.classes || (classes === best.classes && month > best.month))) best = { month, classes };
  }
  return best;
}

/** Milestones reached in a modality (10, 25, 50…) with the day of each, in order. */
export function modalityMilestones(report: ClassReport, modalityId: string) {
  return report.milestones.filter((m) => m.modalityId === modalityId).sort((a, b) => a.count - b.count);
}

export type GraduationStepState = 'done' | 'current' | 'future';

export interface GraduationStep {
  key: string;
  /** Null = Fundamentos (before the first belt). */
  belt: ModalityBelt | null;
  state: GraduationStepState;
  /** Done: classes in the step (null when it was skipped). Current: classes toward the next belt. */
  classes: number | null;
  /** Done: the period in the step (timestamps). Current: since when. */
  from: string | null;
  to: string | null;
  /** Done: classes per week in the period. */
  weeklyAverage: number | null;
  /** Current: classes the next belt requires (null: last belt or not set). Future: classes to reach this belt. */
  goal: number | null;
}

const periodAverage = (classes: number, from: string, to: string) =>
  weeklyAverage(classes, Math.max(1, (Date.parse(to) - Date.parse(from)) / DAY_MS));

/**
 * Every step of the modality's belt sequence, in order (top to bottom):
 * Fundamentos (when the first belt asks for classes, or the student has no
 * belt), then one per belt. Done steps carry the classes, the period and the
 * weekly average; the current one the classes toward the next belt; the
 * future ones only their goal. Same counting as the Jornada and the "4/10".
 */
export function graduationSteps(belts: ModalityBelt[], report: ClassReport, modalityId: string): GraduationStep[] {
  const sequence = [...belts].sort((a, b) => a.position - b.position);
  if (sequence.length === 0) return [];
  const ids = new Set(sequence.map((b) => b.id));
  const awards = report.belts.filter((b) => b.modalityId === modalityId && ids.has(b.beltId));
  const lastAward = new Map(awards.map((a) => [a.beltId, a]));
  const latest = awards[awards.length - 1];
  const currentIndex = latest ? sequence.findIndex((b) => b.id === latest.beltId) : -1;
  const stats = report.modalities.find((m) => m.modalityId === modalityId);
  const total = stats?.total ?? 0;
  const sinceBelt = stats?.sinceBelt ?? total;
  const firstRequired = sequence[0]!.classesRequired ?? 0;
  const steps: GraduationStep[] = [];

  if (firstRequired > 0 || currentIndex === -1) {
    const first = awards[0];
    if (currentIndex === -1 || !first) {
      steps.push({ key: 'start', belt: null, state: 'current', classes: total, from: report.joinedAt, to: null, weeklyAverage: null, goal: firstRequired || null });
    } else {
      // Classes up to the day of the first graduation = all minus the ones done in belts.
      const classes = Math.max(0, total - awards.reduce((a, b) => a + b.classes, 0));
      steps.push({
        key: 'start',
        belt: null,
        state: 'done',
        classes,
        from: report.joinedAt,
        to: first.awardedAt,
        weeklyAverage: periodAverage(classes, report.joinedAt, first.awardedAt),
        goal: null,
      });
    }
  }

  sequence.forEach((belt, i) => {
    const award = lastAward.get(belt.id);
    if (i === currentIndex) {
      steps.push({
        key: belt.id,
        belt,
        state: 'current',
        classes: sinceBelt,
        from: award?.awardedAt ?? null,
        to: null,
        weeklyAverage: null,
        goal: sequence[i + 1]?.classesRequired ?? null,
      });
    } else if (i < currentIndex) {
      const to = award?.nextAwardedAt ?? null;
      steps.push({
        key: belt.id,
        belt,
        state: 'done',
        classes: award ? award.classes : null,
        from: award?.awardedAt ?? null,
        to,
        weeklyAverage: award && to ? periodAverage(award.classes, award.awardedAt, to) : null,
        goal: null,
      });
    } else {
      steps.push({ key: belt.id, belt, state: 'future', classes: null, from: null, to: null, weeklyAverage: null, goal: belt.classesRequired });
    }
  });
  return steps;
}
