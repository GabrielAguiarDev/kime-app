import { ACCESS_HOME, accessLevel, normalizeExternalPath, routeAccess } from '../routeAccess';

describe('accessLevel', () => {
  it('maps session, approval and pending request to a level', () => {
    expect(accessLevel(false, false, false)).toBe('signedOut');
    expect(accessLevel(false, true, true)).toBe('signedOut');
    expect(accessLevel(true, false, false)).toBe('noAcademy');
    expect(accessLevel(true, false, true)).toBe('pendingApproval');
    expect(accessLevel(true, true, false)).toBe('member');
    // An approved membership wins over another academy's pending request.
    expect(accessLevel(true, true, true)).toBe('member');
  });
});

describe('routeAccess (guard)', () => {
  const input = (over = {}) => ({
    signedIn: true,
    hasApprovedMembership: true,
    hasPendingRequest: false,
    isStaff: false,
    isOwner: false,
    ...over,
  });
  const closed = { app: false, staff: false, owner: false };

  it('1. no session: only the entry flow, home is the first screen', () => {
    expect(routeAccess(input({ signedIn: false, hasApprovedMembership: false }))).toEqual({
      level: 'signedOut',
      home: '/sign-in',
      auth: true,
      onboarding: false,
      noAcademy: false,
      pendingApproval: false,
      createAcademy: false,
      ...closed,
    });
  });

  it('2. session, no approved membership, no pending request: academy code signed in', () => {
    expect(routeAccess(input({ hasApprovedMembership: false }))).toEqual({
      level: 'noAcademy',
      home: '/academia',
      auth: false,
      onboarding: true,
      noAcademy: true,
      pendingApproval: false,
      createAcademy: true,
      ...closed,
    });
  });

  it('3. session and a pending request, no approved membership: waiting screen', () => {
    expect(routeAccess(input({ hasApprovedMembership: false, hasPendingRequest: true }))).toEqual({
      level: 'pendingApproval',
      home: '/aguardando',
      auth: false,
      onboarding: true,
      noAcademy: false,
      pendingApproval: true,
      createAcademy: false,
      ...closed,
    });
  });

  it('the signed-in states never reach the entry flow (sign-in, sign-up)', () => {
    for (const hasPendingRequest of [false, true]) {
      expect(routeAccess(input({ hasApprovedMembership: false, hasPendingRequest })).auth).toBe(false);
    }
  });

  it('cancelled or rejected request (pending gone) goes back to the academy code', () => {
    const waiting = routeAccess(input({ hasApprovedMembership: false, hasPendingRequest: true }));
    const after = routeAccess(input({ hasApprovedMembership: false, hasPendingRequest: false }));
    expect([waiting.home, after.home]).toEqual(['/aguardando', '/academia']);
  });

  it('a finishing sign-up keeps /create-gym open after the new membership arrives', () => {
    const owner = routeAccess(input({ isStaff: true, isOwner: true, finishingSignup: true }));
    expect(owner).toMatchObject({ level: 'member', home: '/home', app: true, onboarding: true, createAcademy: true, noAcademy: false });
    expect(routeAccess(input({ isStaff: true, isOwner: true }))).toMatchObject({ onboarding: false, createAcademy: false });
    // Never without a session.
    expect(routeAccess(input({ signedIn: false, finishingSignup: true }))).toMatchObject({ onboarding: false, createAcademy: false });
  });

  it('member reaches the app; staff and owner follow the role', () => {
    expect(routeAccess(input())).toMatchObject({ level: 'member', home: '/home', app: true, onboarding: false, staff: false, owner: false });
    expect(routeAccess(input({ isStaff: true }))).toMatchObject({ staff: true, owner: false });
    expect(routeAccess(input({ isStaff: true, isOwner: true }))).toMatchObject({ staff: true, owner: true });
  });

  it('staff and owner flags never leak without an approved membership', () => {
    for (const signedIn of [true, false]) {
      for (const hasPendingRequest of [true, false]) {
        const r = routeAccess({ signedIn, hasApprovedMembership: false, hasPendingRequest, isStaff: true, isOwner: true });
        expect(r).toMatchObject(closed);
      }
    }
    const r = routeAccess({ signedIn: false, hasApprovedMembership: true, hasPendingRequest: false, isStaff: true, isOwner: true });
    expect(r).toMatchObject({ level: 'signedOut', ...closed });
  });

  it('exposes the home of each level', () => {
    expect(ACCESS_HOME).toEqual({ signedOut: '/sign-in', noAcademy: '/academia', pendingApproval: '/aguardando', member: '/home' });
  });
});

describe('normalizeExternalPath', () => {
  it.each([
    ['kimi://agua', '/agua'],
    ['kimi://competition', '/competition'],
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
