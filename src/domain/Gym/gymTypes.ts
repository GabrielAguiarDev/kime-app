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

/** A live professor code (single use, 7 days), as the owner sees it. */
export interface ProfessorCode {
  id: string;
  code: string;
  expiresAt: string;
}

export interface GymSettings {
  id: string;
  name: string;
  /** IANA zone, e.g. America/Sao_Paulo. Defines "today" for classes. */
  timezone: string;
  logoPath: string | null;
  logoUrl: string | null;
}
