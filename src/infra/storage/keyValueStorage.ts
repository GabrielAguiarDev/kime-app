import Storage from 'expo-sqlite/kv-store';

/**
 * Small synchronous key-value store for app preferences (not secrets, not
 * widget data — widget shared storage comes in phase 3).
 */
export const StorageKeys = {
  activeGymId: 'kimi.activeGymId',
  /** Code confirmed before signing in; turned into a join request right after. */
  pendingCode: 'kimi.pendingCode',
  /** Path chosen on the first screen (student | professor): how to enter, not a role. */
  entryPath: 'kimi.entryPath',
} as const;

type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

/** Keys that exist once per scope (e.g. per user + academy): `${prefix}.${scope}`. */
const ScopedKeys = {
  /** Last class progress the student has already been rewarded for. */
  classRewards: 'kimi.classRewards.v1',
  /** Last day (YYYY-MM-DD) the user already saw "Meta do dia batida", per user. */
  waterGoalCelebrated: 'kimi.waterGoalCelebrated.v1',
  /** Join requests seen (membership id → academy name + decision already shown), per user. */
  joinRequests: 'kimi.joinRequests.v1',
  /** Last water goal sent to the server (`day:goal`), per user: avoids re-sending it on every render. */
  waterGoalRecorded: 'kimi.waterGoalRecorded.v1',
  /** Streak records already celebrated (JSON {water, training}), per user (+ academy for training). */
  streakRecords: 'kimi.streakRecords.v1',
  /** Class reminders switched on on this device ('on'), per user. */
  classReminders: 'kimi.classReminders.v1',
  /** Signature of the reminders last scheduled, per user (skip rescheduling when unchanged). */
  classRemindersPlan: 'kimi.classRemindersPlan.v1',
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
  removeScoped: (key: ScopedKey, scope: string): void => {
    Storage.removeItemSync(scoped(key, scope));
  },
};
