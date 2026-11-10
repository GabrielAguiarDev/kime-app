import { isUserScopedKey } from '../keyValueStorage';

describe('isUserScopedKey (sign-out cleanup)', () => {
  const user = 'u-123';

  it('matches the scoped keys of the user, alone or with more scope', () => {
    expect(isUserScopedKey(`kimi.joinRequests.v1.${user}`, user)).toBe(true);
    expect(isUserScopedKey(`kimi.timerLast.v1.${user}.gym-1`, user)).toBe(true);
    expect(isUserScopedKey(`kimi.streakRecords.v1.${user}.discipline`, user)).toBe(true);
  });

  it('keeps other users, look-alike ids and non-scoped keys', () => {
    expect(isUserScopedKey('kimi.joinRequests.v1.u-999', user)).toBe(false);
    expect(isUserScopedKey(`kimi.joinRequests.v1.${user}4`, user)).toBe(false);
    expect(isUserScopedKey('kimi.classRemindersPlan.v1.signed-out', user)).toBe(false);
    expect(isUserScopedKey('kimi.entryPath', user)).toBe(false);
    expect(isUserScopedKey(`water.log.${user}`, user)).toBe(false);
    expect(isUserScopedKey('kimi.joinRequests.v1.', '')).toBe(false);
  });
});
