/** Kind of an invite code: it decides the role of the join request. */
export type CodeType = 'student' | 'instructor';

/** What anyone (signed in or not) sees for a live code: academy card + kind. */
export interface CodeLookup {
  gymName: string;
  /** Public URL of the academy logo, when it has one. */
  logoUrl: string | null;
  codeType: CodeType;
}

/** Result of asking to join with a code. `active` = already a member. */
export interface JoinResult {
  membershipId: string;
  gymId: string;
  status: 'pending' | 'active' | 'rejected';
  /** False when the user was already a member or already waiting: nothing was created. */
  isNew: boolean;
}

/**
 * The academy's two fixed, reusable invite codes (one active per kind).
 * Instructors only see the student one (RLS), so `instructor` may be absent.
 */
export interface InviteCodes {
  student?: string;
  instructor?: string;
}

export interface GymSettings {
  id: string;
  name: string;
  /** IANA zone, e.g. America/Sao_Paulo. Defines "today" for classes. */
  timezone: string;
  logoPath: string | null;
  logoUrl: string | null;
  /** Days without a confirmed class for a student to count as "sumido" (owner sets, 7–90). */
  inactiveAfterDays: number;
}
