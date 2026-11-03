import { activeMemberships, resolveActiveMembership } from '../membershipRules';
import type { Membership } from '../membershipTypes';

const m = (gymId: string, status: Membership['status'], role: Membership['role'] = 'student'): Membership => ({
  id: `m-${gymId}`,
  gymId,
  gymName: `Gym ${gymId}`,
  role,
  status,
});

describe('resolveActiveMembership', () => {
  it('returns null when there is no active membership', () => {
    expect(resolveActiveMembership([m('a', 'pending'), m('b', 'rejected')], null)).toBeNull();
  });

  it('prefers the stored gym when it is still active', () => {
    const list = [m('a', 'active'), m('b', 'active', 'professor')];
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
