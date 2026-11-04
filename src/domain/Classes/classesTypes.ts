import type { Belt } from '@components';
import type { Enums } from '@infra/supabase';

export type CheckinStatus = Enums<'checkin_status'>;

/** Weekday 0 = Sunday … 6 = Saturday (same as the database). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Academy-local calendar date, `YYYY-MM-DD`. */
export type LocalDate = string;

export interface ClassSchedule {
  id: string;
  academyId: string;
  weekday: Weekday;
  /** `HH:MM` */
  startTime: string;
  modality: string;
  active: boolean;
}

export interface ScheduleInput {
  weekday: Weekday;
  startTime: string;
  modality: string;
}

export interface Checkin {
  id: string;
  userId: string;
  /** Null when the class schedule was deleted (the check-in still counts). */
  scheduleId: string | null;
  classDate: LocalDate;
  status: CheckinStatus;
  reviewedAt: string | null;
}

/** A check-in as listed for the professor, with the student's name. */
export interface AcademyCheckin extends Checkin {
  fullName: string;
}

export interface BeltGoal {
  id: string;
  belt: Belt;
  position: number;
  /** Confirmed classes needed, counted since the previous graduation. */
  classesRequired: number;
}

export interface MemberStats {
  membershipId: string;
  userId: string;
  belt: Belt | null;
  beltAwardedAt: string | null;
  confirmedTotal: number;
  confirmedSinceBelt: number;
}

export interface Modality {
  id: string;
  name: string;
  position: number;
}

export interface BeltAward {
  id: string;
  belt: Belt;
  awardedAt: string;
}
