import { activeMemberships, isOwnerRole, isStaffRole, resolveActiveMembership, splitMembers } from '../membershipRules';
import type { Membership } from '../membershipTypes';

const m = (gymId: string, status: Membership['status'], role: Membership['role'] = 'student'): Membership => ({
  id: `m-${gymId}`,
  gymId,
  gymName: `Gym ${gymId}`,
  gymLogoUrl: null,
  role,
  status,
  isCompetitor: false,
  competitorInvitedAt: null,
  competitorSince: null,
  decidedAt: null,
  modalities: [],
});

describe('resolveActiveMembership', () => {
  it('returns null when there is no active membership', () => {
    expect(resolveActiveMembership([m('a', 'pending'), m('b', 'rejected')], null)).toBeNull();
  });

  it('prefers the stored gym when it is still active', () => {
    const list = [m('a', 'active'), m('b', 'active', 'instructor')];
    expect(resolveActiveMembership(list, 'b')?.gymId).toBe('b');
  });

  it('falls back to the first active gym when the stored one is no longer active', () => {
    const list = [m('a', 'rejected'), m('b', 'active')];
    expect(resolveActiveMembership(list, 'a')?.gymId).toBe('b');
  });

  it('ignores pending memberships', () => {
    expect(activeMemberships([m('a', 'pending'), m('b', 'active')]).map((x) => x.gymId)).toEqual(['b']);
  });
});

describe('roles', () => {
  it('owner and professor are staff; only the owner is owner', () => {
    expect([isStaffRole('owner'), isStaffRole('instructor'), isStaffRole('student'), isStaffRole(null)]).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect([isOwnerRole('owner'), isOwnerRole('instructor'), isOwnerRole('student')]).toEqual([true, false, false]);
  });

  it('splits members into staff (owner first) and students', () => {
    const list = [
      { id: '1', role: 'student' as const },
      { id: '2', role: 'instructor' as const },
      { id: '3', role: 'owner' as const },
      { id: '4', role: 'student' as const },
    ];
    const { staff, students } = splitMembers(list);
    expect(staff.map((m) => m.id)).toEqual(['3', '2']);
    expect(students.map((m) => m.id)).toEqual(['1', '4']);
  });
});
