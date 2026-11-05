import type { LocalDate, Weekday } from '@domain/Classes/classesTypes';

export interface Championship {
  id: string;
  academyId: string;
  /** Every championship belongs to one modality; only its competitors are entered. */
  modalityId: string;
  name: string;
  /** Academy-local date of the event. */
  eventDate: LocalDate;
  location: string;
}

export interface ChampionshipInput {
  modalityId: string;
  name: string;
  eventDate: LocalDate;
  location: string;
}

/** A competitor entered in a championship. */
export interface ChampionshipEntry {
  championshipId: string;
  athleteId: string;
}

/** One weigh-in per athlete and day. */
export interface WeightLog {
  id: string;
  loggedOn: LocalDate;
  weightKg: number;
}

/**
 * Weekly water plan written by staff. It starts on its week (Monday) and holds
 * until a newer one. `targets[weekday]` (0 = Sunday … 6 = Saturday); null = no
 * target that day, the automatic goal applies.
 */
export interface WaterPlan {
  id: string;
  academyId: string;
  weekStart: LocalDate;
  updatedAt: string;
  targets: WeekTargets;
  /** `limits[weekday]` true = the target is a limit (done between 90 % and 100 %), false = a goal. */
  limits: WeekLimits;
}

export type WeekTargets = Record<Weekday, number | null>;
export type WeekLimits = Record<Weekday, boolean>;
