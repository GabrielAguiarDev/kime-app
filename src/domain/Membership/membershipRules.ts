import type { Membership, MembershipRole } from './membershipTypes';

export const roleLabel: Record<MembershipRole, string> = {
  student: 'Aluno',
  professor: 'Professor',
};

/** Label shown for a membership: competitor is a flag on a student. */
export function membershipLabel(m: Pick<Membership, 'role' | 'isCompetitor'>): string {
  return m.isCompetitor ? 'Competidor' : roleLabel[m.role];
}

/** Memberships that give access to a gym's content. */
export function activeMemberships(memberships: Membership[]): Membership[] {
  return memberships.filter((m) => m.status === 'active');
}

/**
 * Picks the gym the app should open on: the stored one when still active,
 * otherwise the first active membership.
 */
export function resolveActiveMembership(
  memberships: Membership[],
  storedGymId: string | null,
): Membership | null {
  const active = activeMemberships(memberships);
  return active.find((m) => m.gymId === storedGymId) ?? active[0] ?? null;
}
