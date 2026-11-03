import { useState } from 'react';
import { Appearance } from 'react-native';

import { keyValueStorage, StorageKeys } from '@infra';

/** App theme chosen by the user. Dark is the default (user decision). */
export type AppearancePreference = 'dark' | 'light' | 'system';

export const DEFAULT_APPEARANCE: AppearancePreference = 'dark';

const isPreference = (v: string | null): v is AppearancePreference =>
  v === 'dark' || v === 'light' || v === 'system';

function read(): AppearancePreference {
  const stored = keyValueStorage.get(StorageKeys.appearance);
  return isPreference(stored) ? stored : DEFAULT_APPEARANCE;
}

/**
 * Overrides the app color scheme. `useColorScheme()` (and so the restyle theme, the
 * navigation theme and native alerts/keyboard) follows the override.
 */
function apply(pref: AppearancePreference) {
  Appearance.setColorScheme(pref === 'system' ? 'auto' : pref);
}

/** Call once at startup, before the first render (storage is synchronous: no light flash). */
export function initAppearance() {
  apply(read());
}

/** Current preference + setter that persists and applies it immediately. */
export function useAppearancePreference() {
  const [preference, setPreference] = useState<AppearancePreference>(read);
  const update = (pref: AppearancePreference) => {
    keyValueStorage.set(StorageKeys.appearance, pref);
    apply(pref);
    setPreference(pref);
  };
  return [preference, update] as const;
}
