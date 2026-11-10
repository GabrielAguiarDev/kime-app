import type { LocalDate } from '@domain/Classes/classesTypes';

/** A closed week of the Disciplina (the database decides; see my_discipline). */
export type DisciplineWeekState = 'done' | 'frozen' | 'missed';

/** Water of a day with the shared rule (goal, or limit between 90 % and 100 %). */
export type DisciplineWater = 'unconfigured' | 'progress' | 'done' | 'over';

export interface DisciplineDay {
  day: LocalDate;
  water: DisciplineWater;
  /** Classes confirmed by the professor that day (any academy and modality). */
  confirmed: number;
  /** Check-ins still waiting for the professor that day. */
  pending: number;
}

/**
 * The single weekly streak ("Disciplina"): a week (Monday–Sunday, São Paulo)
 * is done with at least one confirmed class and the water goal met on at
 * least 5 days. Computed and stored by the database.
 */
export interface Discipline {
  today: LocalDate;
  /** Monday of the current week. */
  weekStart: LocalDate;
  /** Weeks in a row (the current one included once done). */
  current: number;
  record: number;
  /** Freezes in stock (0–2). */
  freezes: number;
  /** The current week is already done. */
  weekDone: boolean;
  /** The current week, Monday to Sunday. */
  days: DisciplineDay[];
  /** Last closed weeks, oldest first. */
  weeks: { weekStart: LocalDate; state: DisciplineWeekState }[];
}
