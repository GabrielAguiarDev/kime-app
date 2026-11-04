import { useEffect, useState } from 'react';

import { useCodeLookup, type CodeLookup } from '@domain/Gym';
import { pendingCode } from '@services/entry';

/**
 * Academy of the code confirmed before signing in (shown on top of the auth
 * screens). A saved code that stopped working (revoked, used, expired) is
 * forgotten right away instead of failing after the sign-in.
 */
export function usePendingAcademy(): CodeLookup | null {
  const [savedCode] = useState(() => pendingCode.get());
  const lookup = useCodeLookup(savedCode ?? undefined);
  const codeGone = !!savedCode && lookup.isSuccess && lookup.data === null;

  useEffect(() => {
    if (codeGone) pendingCode.clear();
  }, [codeGone]);

  return savedCode && !codeGone ? (lookup.data ?? null) : null;
}
