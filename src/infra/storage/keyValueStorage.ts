import Storage from 'expo-sqlite/kv-store';

/**
 * Small synchronous key-value store for app preferences (not secrets, not
 * widget data — widget shared storage comes in phase 3).
 */
export const StorageKeys = {
  activeGymId: 'kimi.activeGymId',
  pendingInviteToken: 'kimi.pendingInviteToken',
  appearance: 'kimi.appearance',
} as const;

type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

export const keyValueStorage = {
  get: (key: StorageKey): string | null => Storage.getItemSync(key),
  set: (key: StorageKey, value: string): void => Storage.setItemSync(key, value),
  remove: (key: StorageKey): void => {
    Storage.removeItemSync(key);
  },
};
