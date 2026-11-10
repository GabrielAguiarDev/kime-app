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
 * Contacts are null when the viewer may not see them.
 */
export interface InstructorProfile {
  membershipId: string;
  userId: string;
  fullName: string;
  avatarPath: string | null;
  role: MembershipRole;
  memberSince: string;
  bio: string | null;
  /** Handle without "@". */
  instagram: string | null;
  /** Digits with country code (wa.me format). */
  whatsapp: string | null;
  showContactsToStudents: boolean;
  /** Graduations the person made in the academy. */
  graduationsCount: number;
  /** Active competitors in the person's modalities. */
  competitorsCount: number;
  modalityIds: string[];
  belts: InstructorBelt[];
  schedules: InstructorSchedule[];
}

/** What the person edits on their own profile. */
export interface InstructorProfileInput {
  bio: string | null;
  instagram: string | null;
  whatsapp: string | null;
  showContactsToStudents: boolean;
}
