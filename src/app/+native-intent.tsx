import { normalizeExternalPath } from '@services/access';

/**
 * Links from outside the app (widget, deep links, notifications) before
 * routing: only known paths pass, anything else opens "/". Who may see the
 * screen is decided by the root guards (services/access), never here: this
 * runs outside React and does not know the session.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return normalizeExternalPath(path);
}
