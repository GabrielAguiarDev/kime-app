import type { Href } from 'expo-router';

/**
 * THE route access rule of the app (single source of truth). Every way into a
 * screen goes through it: in-app navigation, deep links, the widget and
 * notifications (they all resolve to a route, and the root Stack guards use
 * these flags with `redirectTo`).
 *
 *  - signedOut         → only the entry flow (start, code, sign-in/up); home = /start
 *  - awaitingApproval  → signed in, no APPROVED membership: waiting screen,
 *                        create academy, code entry; home = /welcome
 *  - member            → at least one approved membership: the app; home = /home
 *
 * Staff/owner screens add the role of the active academy on top of `member`.
 */
export type AccessLevel = 'signedOut' | 'awaitingApproval' | 'member';

export interface AccessInput {
  signedIn: boolean;
  /** At least one membership with status active (approved). */
  hasApprovedMembership: boolean;
  isStaff: boolean;
  isOwner: boolean;
}

export interface RouteAccess {
  level: AccessLevel;
  /** Where a blocked navigation lands. */
  home: Href;
  /** (auth) group: start, code, sign-in, sign-up, verify-email. */
  auth: boolean;
  /** (onboarding) group: waiting screen, create academy. */
  onboarding: boolean;
  /** Tabs and every app screen (water, achievement…). */
  app: boolean;
  /** Owner or instructor of the active academy. */
  staff: boolean;
  /** Owner of the active academy. */
  owner: boolean;
}

export const ACCESS_HOME: Record<AccessLevel, Href> = {
  signedOut: '/start',
  awaitingApproval: '/welcome',
  member: '/home',
};

export function accessLevel(signedIn: boolean, hasApprovedMembership: boolean): AccessLevel {
  if (!signedIn) return 'signedOut';
  return hasApprovedMembership ? 'member' : 'awaitingApproval';
}

export function routeAccess({ signedIn, hasApprovedMembership, isStaff, isOwner }: AccessInput): RouteAccess {
  const level = accessLevel(signedIn, hasApprovedMembership);
  const app = level === 'member';
  return {
    level,
    home: ACCESS_HOME[level],
    auth: level === 'signedOut',
    onboarding: level === 'awaitingApproval',
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
