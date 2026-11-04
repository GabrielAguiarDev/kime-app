import type { Enums } from '@infra/supabase';

export type MembershipRole = Enums<'membership_role'>;
export type MembershipStatus = Enums<'membership_status'>;

/** A membership of the signed-in user, with the gym it belongs to. */
export interface Membership {
  id: string;
  gymId: string;
  /** Empty when the academy is no longer readable (e.g. a rejected request). */
  gymName: string;
  gymLogoUrl: string | null;
  role: MembershipRole;
  status: MembershipStatus;
  /** Only students compete. */
  isCompetitor: boolean;
  belt: string | null;
}

/** A member of a gym as seen by its professor. */
export interface GymMember {
  id: string;
  userId: string;
  fullName: string;
  role: MembershipRole;
  status: MembershipStatus;
  isCompetitor: boolean;
  belt: string | null;
  createdAt: string;
}

/** A pending join request, as seen by a professor of the gym. */
export interface PendingRequest {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  role: MembershipRole;
  requestedAt: string;
}
