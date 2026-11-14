import type { Enums } from '@infra/supabase';

export type MembershipRole = Enums<'membership_role'>;
export type MembershipStatus = Enums<'membership_status'>;

/** Active link of a student to a modality of the academy (competitor flag per modality). */
export interface StudentModality {
  enrollmentId: string;
  modalityId: string;
  /** Start of the current link. */
  startedAt: string;
  /** Accepted the invite to compete in this modality. */
  isCompetitor: boolean;
  /** Pending invite to compete in this modality. */
  competitorInvitedAt: string | null;
  competitorSince: string | null;
}

/** A membership of the signed-in user, with the gym it belongs to. */
export interface Membership {
  id: string;
  gymId: string;
  /** Empty when the academy is no longer readable (e.g. a rejected request). */
  gymName: string;
  gymLogoUrl: string | null;
  role: MembershipRole;
  status: MembershipStatus;
  /** Competes in at least one modality (water plan, diet and weight are per athlete and academy). */
  isCompetitor: boolean;
  /** Legacy membership-level invite (always null since the invites moved to the modalities). */
  competitorInvitedAt: string | null;
  /** First acceptance among the modalities. */
  competitorSince: string | null;
  /** When the request was approved/rejected (null while pending). */
  decidedAt: string | null;
  /** Active modalities of a student (empty for owner/professor). */
  modalities: StudentModality[];
}

/** A member of a gym as seen by its professor. */
export interface GymMember {
  id: string;
  userId: string;
  fullName: string;
  role: MembershipRole;
  status: MembershipStatus;
  isCompetitor: boolean;
  competitorInvitedAt: string | null;
  competitorSince: string | null;
  /** Profile photo in the private `avatars` bucket (read with a signed URL). */
  avatarPath: string | null;
  createdAt: string;
  /** Active modalities of a student (empty for owner/professor). */
  modalities: StudentModality[];
}

/**
 * An active student with no confirmed class for the academy's threshold
 * (academies.inactive_after_days). Dates in the academy calendar.
 */
export interface InactiveStudent {
  membershipId: string;
  userId: string;
  /** Last confirmed class since joining; null = none since then. */
  lastClassDate: string | null;
  /** Day the membership was approved. */
  joinedOn: string;
  /** The last class, or the join day for who never trained. */
  inactiveSince: string;
}

/** A pending join request, as seen by a professor of the gym. */
export interface PendingRequest {
  avatarPath: string | null;
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  role: MembershipRole;
  requestedAt: string;
}
