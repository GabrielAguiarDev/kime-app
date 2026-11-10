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
  modalityId: string;
  /** Name of the modality (display). */
  modality: string;
  active: boolean;
}

export interface ScheduleInput {
  weekday: Weekday;
  startTime: string;
  modalityId: string;
}

export interface Checkin {
  id: string;
  userId: string;
  /** Null when the class schedule was deleted (the check-in still counts). */
  scheduleId: string | null;
  /** Modality of the class at check-in time (null if the modality was deleted). */
  modalityId: string | null;
  classDate: LocalDate;
  status: CheckinStatus;
  reviewedAt: string | null;
}

/** A check-in as listed for the professor, with the student's name. */
export interface AcademyCheckin extends Checkin {
  fullName: string;
  avatarPath: string | null;
}

/** Belt colors of the design-system palette (2.4), stored as keys. */
export type BeltColorKey =
  | 'white'
  | 'gray'
  | 'yellow'
  | 'orange'
  | 'green'
  | 'blue'
  | 'purple'
  | 'brown'
  | 'black'
  | 'red'
  // Extra shades ("Mais cores").
  | 'light_gray'
  | 'dark_gray'
  | 'dark_yellow'
  | 'light_green'
  | 'dark_green'
  | 'light_blue'
  | 'dark_blue'
  | 'light_purple'
  | 'light_brown'
  | 'dark_red';

/** How a belt looks: main color and optional tip. Name and colors are derived from the keys. */
export interface BeltLook {
  primary: BeltColorKey;
  tip: BeltColorKey | null;
}

/** One belt of a modality's sequence (owner-defined). */
export interface ModalityBelt extends BeltLook {
  id: string;
  modalityId: string;
  position: number;
  /**
   * Confirmed classes in the previous belt (since that graduation) to receive
   * this one; for the first belt, classes without a belt. Always asked in the
   * app; null only for old data (shown as "Defina as aulas necessárias").
   */
  classesRequired: number | null;
}

export interface BeltInput extends BeltLook {
  classesRequired: number | null;
}

/** Confirmed classes of a student in the academy (every modality). */
export interface MemberStats {
  membershipId: string;
  userId: string;
  confirmedTotal: number;
}

/** A student's progress in one modality. */
export interface ModalityStats {
  membershipId: string;
  userId: string;
  modalityId: string;
  /** Current belt in the modality (latest award); null = none yet. */
  beltId: string | null;
  beltAwardedAt: string | null;
  /** Confirmed classes in this modality. */
  confirmedTotal: number;
  /** Confirmed classes in this modality after the day of the last graduation in it. */
  confirmedSinceBelt: number;
}

export interface Modality {
  id: string;
  name: string;
  position: number;
  /** Has a belt sequence; false = only the class count. */
  usesBelts: boolean;
}

/** A graduation of the student in the report: the time in that belt. */
export interface ReportBelt {
  modalityId: string;
  beltId: string;
  awardedAt: string;
  /** Null = the current belt. */
  nextAwardedAt: string | null;
  /** Confirmed classes done in this belt. */
  classes: number;
}

/** Training report of one student (class_report): raw numbers, see classReport.ts for the views. */
export interface ClassReport {
  /** Membership start ("Treina aqui desde"). */
  joinedAt: string;
  today: LocalDate;
  /** Start of the "last 3 months" window (or the membership start when later). */
  recentSince: LocalDate;
  enrollments: { modalityId: string; status: string; isCompetitor: boolean }[];
  /** Confirmed classes per modality: all, since the last graduation, in the recent window. */
  modalities: { modalityId: string; total: number; sinceBelt: number; recent: number }[];
  /** Confirmed classes per month (first day of the month) and modality, whole history. */
  months: { month: LocalDate; modalityId: string | null; classes: number }[];
  /** Mondays of every week with a confirmed class. */
  weeks: LocalDate[];
  /** Graduations, oldest first. */
  belts: ReportBelt[];
  /** Day of the 10th, 25th, 50th, 100th… confirmed class per modality. */
  milestones: { modalityId: string; count: number; date: LocalDate }[];
}

export interface BeltAward {
  id: string;
  modalityId: string;
  beltId: string;
  belt: BeltLook;
  awardedAt: string;
}

/** A class actually given (schedule + date): created when its first check-in is confirmed. */
export interface ClassSession {
  id: string;
  /** Null when the schedule was deleted later. */
  scheduleId: string | null;
  classDate: LocalDate;
  /** Who taught it: the owner by default; staff can switch it. */
  instructorId: string | null;
}

/** Classes taught by an owner/instructor membership. */
export interface InstructorStats {
  membershipId: string;
  userId: string;
  classesTaught: number;
}
