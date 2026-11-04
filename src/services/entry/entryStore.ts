import type { CodeType } from '@domain/Gym';
import { keyValueStorage, StorageKeys } from '@infra';

/**
 * "Sou aluno" / "Sou professor" on the first screen. It only picks the way
 * in (code first vs. sign-in first) and is remembered on this device. It is
 * NOT a role: after sign-in the app follows the memberships.
 */
export type EntryPath = CodeType;

export const entryPath = {
  get: (): EntryPath | null => {
    const value = keyValueStorage.get(StorageKeys.entryPath);
    if (value === 'professor') return 'instructor';
    return value === 'student' || value === 'instructor' ? value : null;
  },
  set: (path: EntryPath) => keyValueStorage.set(StorageKeys.entryPath, path),
  clear: () => keyValueStorage.remove(StorageKeys.entryPath),
};

/** A confirmed code waits this long for the account; after that it is dropped. */
const PENDING_CODE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Code confirmed before signing in ("É essa a sua academia?" → Sim). The join
 * request is sent right after the next sign-in or sign-up. Expires after a
 * day and is cleared on sign-out, so it never reaches another account.
 */
export const pendingCode = {
  get: (): string | null => {
    const raw = keyValueStorage.get(StorageKeys.pendingCode);
    if (!raw) return null;
    try {
      const { code, savedAt } = JSON.parse(raw) as { code?: unknown; savedAt?: unknown };
      if (typeof code === 'string' && typeof savedAt === 'number' && Date.now() - savedAt < PENDING_CODE_TTL_MS) {
        return code;
      }
    } catch {
      // Old or corrupt value: drop it below.
    }
    keyValueStorage.remove(StorageKeys.pendingCode);
    return null;
  },
  set: (code: string) => keyValueStorage.set(StorageKeys.pendingCode, JSON.stringify({ code, savedAt: Date.now() })),
  clear: () => keyValueStorage.remove(StorageKeys.pendingCode),
};
