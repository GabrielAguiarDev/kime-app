import type { Weekday } from '@domain/Classes';
import type { MembershipRole } from '@domain/Membership';

/** An active class the person gives (class_schedules.instructor_id). */
export interface InstructorSchedule {
  id: string;
  modalityId: string;
  weekday: Weekday;
  /** `HH:MM` */
  startTime: string;
}

/** The person's own belt in a modality (from the academy's belt sequence). */
export interface InstructorBelt {
  modalityId: string;
  beltId: string;
}

/**
 * An owner / instructor as shown on their profile (get_instructor_profile).
 */
export interface InstructorProfile {
  membershipId: string;
  userId: string;
  fullName: string;
  avatarPath: string | null;
  role: MembershipRole;
  memberSince: string;
  bio: string | null;
  modalityIds: string[];
  belts: InstructorBelt[];
  schedules: InstructorSchedule[];
}

/** What the person edits on their own profile (belts save on their own). */
export interface InstructorProfileInput {
  bio: string | null;
}
