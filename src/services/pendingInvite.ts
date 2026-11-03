import { keyValueStorage, StorageKeys } from '@infra';

/**
 * Invite token opened before the user had an account / session. Consumed
 * (membership requested) right after the next sign-in or sign-up.
 */
export const pendingInvite = {
  save: (token: string) => keyValueStorage.set(StorageKeys.pendingInviteToken, token),
  get: () => keyValueStorage.get(StorageKeys.pendingInviteToken),
  clear: () => keyValueStorage.remove(StorageKeys.pendingInviteToken),
};
