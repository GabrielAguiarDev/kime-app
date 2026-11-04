import { ACCESS_HOME, accessLevel, normalizeExternalPath, routeAccess } from '../routeAccess';

describe('accessLevel', () => {
  it('maps sign-in and approval to a level', () => {
    expect(accessLevel(false, false)).toBe('signedOut');
    expect(accessLevel(false, true)).toBe('signedOut');
    expect(accessLevel(true, false)).toBe('awaitingApproval');
    expect(accessLevel(true, true)).toBe('member');
  });
});

describe('routeAccess', () => {
  const input = (over = {}) => ({ signedIn: true, hasApprovedMembership: true, isStaff: false, isOwner: false, ...over });

  it('signed out only reaches the auth flow', () => {
    expect(routeAccess(input({ signedIn: false }))).toEqual({
      level: 'signedOut', home: '/start', auth: true, onboarding: false, app: false, staff: false, owner: false,
    });
  });

  it('awaiting approval only reaches onboarding', () => {
    expect(routeAccess(input({ hasApprovedMembership: false }))).toEqual({
      level: 'awaitingApproval', home: '/welcome', auth: false, onboarding: true, app: false, staff: false, owner: false,
    });
  });

  it('member reaches the app; staff and owner follow the role', () => {
    expect(routeAccess(input())).toMatchObject({ level: 'member', home: '/home', app: true, staff: false, owner: false });
    expect(routeAccess(input({ isStaff: true }))).toMatchObject({ staff: true, owner: false });
    expect(routeAccess(input({ isStaff: true, isOwner: true }))).toMatchObject({ staff: true, owner: true });
  });

  it('staff and owner flags never leak without an approved membership', () => {
    for (const signedIn of [true, false]) {
      const r = routeAccess({ signedIn, hasApprovedMembership: false, isStaff: true, isOwner: true });
      expect(r.staff).toBe(false);
      expect(r.owner).toBe(false);
    }
    // approved membership flag without a session is still signed out
    const r = routeAccess({ signedIn: false, hasApprovedMembership: true, isStaff: true, isOwner: true });
    expect(r).toMatchObject({ level: 'signedOut', app: false, staff: false, owner: false });
  });

  it('exposes the home of each level', () => {
    expect(ACCESS_HOME).toEqual({ signedOut: '/start', awaitingApproval: '/welcome', member: '/home' });
  });
});

describe('normalizeExternalPath', () => {
  it.each([
    ['kimi://agua', '/agua'],
    ['kimi:///agua', '/agua'],
    ['kimi://agua/configurar', '/agua/configurar'],
    ['/agua', '/agua'],
    ['agua', '/agua'],
    ['/agua/', '/agua'],
    ['//agua', '/agua'],
    ['  /agua  ', '/agua'],
    ['/entrar', '/entrar'],
    ['/', '/'],
    ['', '/'],
    ['kimi://', '/'],
  ])('accepts %j -> %j', (raw, expected) => {
    expect(normalizeExternalPath(raw)).toBe(expected);
  });

  it('keeps the query string', () => {
    expect(normalizeExternalPath('/agua?x=1')).toBe('/agua?x=1');
    expect(normalizeExternalPath('kimi://agua?x=1&y=2')).toBe('/agua?x=1&y=2');
    expect(normalizeExternalPath('/agua?a=b?c')).toBe('/agua?a=b?c');
  });

  it('drops fragments', () => {
    expect(normalizeExternalPath('/agua#top')).toBe('/agua');
    expect(normalizeExternalPath('/agua?x=1#top')).toBe('/agua?x=1');
  });

  it('falls back to "/" for paths outside the allowlist', () => {
    for (const raw of ['/home', '/admin', '/agua/outra', '/agua/configurar/x', '/AGUA', '/agua/../home', '../agua', '%2Fagua', '/\\agua']) {
      expect(normalizeExternalPath(raw)).toBe('/');
    }
  });

  it('does not throw on non-string input', () => {
    expect(normalizeExternalPath(undefined as unknown as string)).toBe('/');
    expect(normalizeExternalPath(null as unknown as string)).toBe('/');
  });

  it('drops the query together with a non-allowlisted path', () => {
    expect(normalizeExternalPath('/home?x=1')).toBe('/');
  });
});
