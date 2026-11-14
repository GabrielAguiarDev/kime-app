import { daysBetween } from '@domain/Competition/competitionRules';

import type { GymMember, InactiveStudent, Membership, MembershipRole } from './membershipTypes';

export const roleLabel: Record<MembershipRole, string> = {
  owner: 'Proprietário',
  instructor: 'Professor',
  student: 'Aluno',
};

/** Owner or professor: runs classes, check-ins, student requests, belts, competitors. */
export function isStaffRole(role: MembershipRole | null | undefined): boolean {
  return role === 'owner' || role === 'instructor';
}

/** Only the owner manages professors, removes members and changes academy settings. */
export function isOwnerRole(role: MembershipRole | null | undefined): boolean {
  return role === 'owner';
}

/** Alunos tab: staff (owner first) and students, each in its own section. */
export function splitMembers<T extends Pick<GymMember, 'role'>>(members: T[]): { staff: T[]; students: T[] } {
  const staff = members.filter((m) => isStaffRole(m.role));
  staff.sort((a, b) => Number(isOwnerRole(b.role)) - Number(isOwnerRole(a.role)));
  return { staff, students: members.filter((m) => m.role === 'student') };
}

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

/** Days since the last confirmed class (or since joining, for who never trained). */
export function inactiveDays(student: InactiveStudent, today: string): number {
  return daysBetween(student.inactiveSince, today);
}

/** "Último treino há 18 dias" / "Sem treino desde que entrou · há 20 dias" (classes before rejoining do not count). */
export function inactiveLabel(student: InactiveStudent, today: string): string {
  const days = inactiveDays(student, today);
  const ago = days === 1 ? 'há 1 dia' : `há ${days} dias`;
  return student.lastClassDate ? `Último treino ${ago}` : `Sem treino desde que entrou · ${ago}`;
}
