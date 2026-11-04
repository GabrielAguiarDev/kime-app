import Storage from 'expo-sqlite/kv-store';

/**
 * Small synchronous key-value store for app preferences (not secrets, not
 * widget data — widget shared storage comes in phase 3).
 */
export const StorageKeys = {
  activeGymId: 'kimi.activeGymId',
  pendingInviteToken: 'kimi.pendingInviteToken',
} as const;

type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

/** Keys that exist once per scope (e.g. per user + academy): `${prefix}.${scope}`. */
const ScopedKeys = {
  /** Last class progress the student has already been rewarded for. */
  classRewards: 'kimi.classRewards.v1',
} as const;

type ScopedKey = keyof typeof ScopedKeys;
const scoped = (key: ScopedKey, scope: string) => `${ScopedKeys[key]}.${scope}`;

export const keyValueStorage = {
  get: (key: StorageKey): string | null => Storage.getItemSync(key),
  set: (key: StorageKey, value: string): void => Storage.setItemSync(key, value),
  remove: (key: StorageKey): void => {
    Storage.removeItemSync(key);
  },
  getScoped: (key: ScopedKey, scope: string): string | null => Storage.getItemSync(scoped(key, scope)),
  setScoped: (key: ScopedKey, scope: string, value: string): void => Storage.setItemSync(scoped(key, scope), value),
};
