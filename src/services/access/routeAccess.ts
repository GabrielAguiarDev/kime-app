import type { Href } from 'expo-router';

/**
 * THE route access rule of the app (single source of truth). Every way into a
 * screen goes through it: in-app navigation, deep links, the widget and
 * notifications (they all resolve to a route, and the Stack guards use these
 * flags with `redirectTo`). Sign-in, sign-up and reopening the app land on the
 * home of the new level the same way.
 *
 *  - signedOut        → only the entry flow (start, code, sign-in/up); home = /start
 *  - noAcademy        → signed in, no approved membership and no pending
 *                       request: academy code (student) or create academy /
 *                       professor code (professor), signed in; home = /academia
 *  - pendingApproval  → signed in, a pending request and no approved
 *                       membership: waiting screen; home = /aguardando
 *  - member           → at least one approved membership: the app; home = /home
 *
 * Staff/owner screens add the role of the active academy on top of `member`.
 *
 * `finishingSignup`: the academy sign-up is creating / has just created the
 * academy; /create-gym stays open (whatever the level) until "Ir para o app".
 */
export type AccessLevel = 'signedOut' | 'noAcademy' | 'pendingApproval' | 'member';

export interface AccessInput {
  signedIn: boolean;
  /** At least one membership with status active (approved). */
  hasApprovedMembership: boolean;
  /** At least one membership with status pending (a request waiting for a decision). */
  hasPendingRequest: boolean;
  /** Academy sign-up between "Criar academia" and "Ir para o app" (academySignup). */
  finishingSignup?: boolean;
  isStaff: boolean;
  isOwner: boolean;
}

export interface RouteAccess {
  level: AccessLevel;
  /** Where a blocked navigation lands. */
  home: Href;
  /** (auth) group: start, code, sign-in, sign-up, verify-email. */
  auth: boolean;
  /** (onboarding) group: any signed-in state without an approved membership. */
  onboarding: boolean;
  /** Inside (onboarding): academy code / professor options, create academy. */
  noAcademy: boolean;
  /** Inside (onboarding): the waiting screen. */
  pendingApproval: boolean;
  /** Inside (onboarding): the academy sign-up (/create-gym). */
  createAcademy: boolean;
  /** Tabs and every app screen (water, achievement…). */
  app: boolean;
  /** Owner or instructor of the active academy. */
  staff: boolean;
  /** Owner of the active academy. */
  owner: boolean;
}

export const ACCESS_HOME: Record<AccessLevel, Href> = {
  signedOut: '/start',
  noAcademy: '/academia',
  pendingApproval: '/aguardando',
  member: '/home',
};

export function accessLevel(signedIn: boolean, hasApprovedMembership: boolean, hasPendingRequest: boolean): AccessLevel {
  if (!signedIn) return 'signedOut';
  if (hasApprovedMembership) return 'member';
  return hasPendingRequest ? 'pendingApproval' : 'noAcademy';
}

export function routeAccess({
  signedIn,
  hasApprovedMembership,
  hasPendingRequest,
  finishingSignup = false,
  isStaff,
  isOwner,
}: AccessInput): RouteAccess {
  const level = accessLevel(signedIn, hasApprovedMembership, hasPendingRequest);
  const app = level === 'member';
  const signup = signedIn && finishingSignup;
  return {
    level,
    home: ACCESS_HOME[level],
    auth: level === 'signedOut',
    onboarding: level === 'noAcademy' || level === 'pendingApproval' || signup,
    noAcademy: level === 'noAcademy',
    pendingApproval: level === 'pendingApproval',
    createAcademy: level === 'noAcademy' || signup,
    app,
    staff: app && isStaff,
    owner: app && isOwner,
  };
}

/**
 * Paths a link from outside the app may open (custom scheme `kimi://`).
 * Anything else falls back to "/", which redirects to the right home.
 * Access itself is still decided by the guards above.
 */
const EXTERNAL_PATHS = new Set(['/', '/entrar', '/agua', '/agua/configurar', '/competition', '/timer']);

export function normalizeExternalPath(raw: string): string {
  // Parsed by hand: React Native's URL polyfill does not implement pathname/search.
  // Accepts `kimi://agua`, `kimi:///agua`, `/agua`, `agua`, with an optional query.
  const withoutScheme = (raw ?? '').trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const [pathPart = '', ...queryParts] = withoutScheme.split('?');
  const query = queryParts.length ? `?${queryParts.join('?').split('#')[0]}` : '';
  const path = `/${pathPart.split('#')[0]}`.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
  if (!EXTERNAL_PATHS.has(path)) return '/';
  return `${path}${query}`;
}
