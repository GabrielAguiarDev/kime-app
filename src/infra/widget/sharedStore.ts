import { requireOptionalNativeModule } from 'expo';
import Storage from 'expo-sqlite/kv-store';

/**
 * Key-value store shared with the home-screen widgets: iOS App Group
 * (`group.br.com.kimi.app`) / Android SharedPreferences (`kimi_widget`),
 * through the local native module `modules/kimi-widget`.
 *
 * Builds without that module (an old dev client, Jest) fall back to the
 * app-only kv-store: water keeps working in the app, widgets just do not see it.
 */
interface KimiWidgetNativeModule {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  getItems(prefix: string): Record<string, string>;
  reloadWidgets(): void;
  isPinSupported(): boolean;
  requestPin(): Promise<boolean>;
}

const native = requireOptionalNativeModule<KimiWidgetNativeModule>('KimiWidget');

const fallback = {
  getItem: (key: string) => Storage.getItemSync(key),
  setItem: (key: string, value: string) => Storage.setItemSync(key, value),
  removeItem: (key: string) => void Storage.removeItemSync(key),
  getItems: (prefix: string) => {
    const items: Record<string, string> = {};
    for (const key of Storage.getAllKeysSync()) {
      if (!key.startsWith(prefix)) continue;
      const value = Storage.getItemSync(key);
      if (value !== null) items[key] = value;
    }
    return items;
  },
};

export const sharedStore = {
  /** True when the widgets can actually read what the app writes. */
  isShared: !!native,
  getItem: (key: string): string | null => (native ?? fallback).getItem(key),
  setItem: (key: string, value: string): void => (native ?? fallback).setItem(key, value),
  removeItem: (key: string): void => (native ?? fallback).removeItem(key),
  /** Every key starting with `prefix`, with its value. */
  getItems: (prefix: string): Record<string, string> => (native ?? fallback).getItems(prefix),
  /** Re-renders the widgets after the app changes their data. */
  reloadWidgets: (): void => native?.reloadWidgets(),
};

/** "Adicionar widget": Android pins it from the app; iOS has no such API. */
export const widgetPinning = {
  isSupported: (): boolean => native?.isPinSupported() ?? false,
  request: (): Promise<boolean> => native?.requestPin() ?? Promise.resolve(false),
};
