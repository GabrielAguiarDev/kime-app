import Storage from 'expo-sqlite/kv-store';

import { sharedStore } from '@infra/widget';

import type { WaterLog, WaterWidgetConfig } from './waterTypes';

/**
 * Water data in the storage shared with the widgets. The key layout is a
 * contract with the native widgets (modules/kimi-widget, targets/widgets):
 *   water.config     WaterWidgetConfig (JSON)
 *   water.log.<id>   WaterLog (JSON) — one key per log, so the app and the
 *                    widget never rewrite the same value.
 */
const CONFIG_KEY = 'water.config';
const LOG_PREFIX = 'water.log.';

/** Phase 1/2 kept the logs of a user in one app-only kv-store value. */
const legacyKey = (userId: string) => `kimi.water.v1.${userId}`;

function parseLog(raw: string): WaterLog | null {
  try {
    const value = JSON.parse(raw) as Partial<WaterLog>;
    if (typeof value.id !== 'string' || typeof value.userId !== 'string') return null;
    if (typeof value.amountMl !== 'number' || typeof value.loggedAt !== 'string') return null;
    return {
      id: value.id,
      userId: value.userId,
      amountMl: value.amountMl,
      loggedAt: value.loggedAt,
      source: value.source === 'widget' ? 'widget' : 'app',
      synced: value.synced === true,
      deleted: value.deleted === true,
    };
  } catch {
    return null;
  }
}

function list(userId: string): WaterLog[] {
  return Object.values(sharedStore.getItems(LOG_PREFIX))
    .map(parseLog)
    .filter((log): log is WaterLog => log !== null && log.userId === userId);
}

function get(id: string): WaterLog | null {
  const raw = sharedStore.getItem(LOG_PREFIX + id);
  return raw ? parseLog(raw) : null;
}

function put(log: WaterLog): void {
  sharedStore.setItem(LOG_PREFIX + log.id, JSON.stringify(log));
}

function remove(id: string): void {
  sharedStore.removeItem(LOG_PREFIX + id);
}

function readConfig(): WaterWidgetConfig | null {
  const raw = sharedStore.getItem(CONFIG_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WaterWidgetConfig;
  } catch {
    return null;
  }
}

function writeConfig(config: WaterWidgetConfig | null): void {
  if (config) sharedStore.setItem(CONFIG_KEY, JSON.stringify(config));
  else sharedStore.removeItem(CONFIG_KEY);
}

/** Moves logs saved by older builds into the shared storage (once per user). */
function migrateLegacy(userId: string): void {
  const raw = Storage.getItemSync(legacyKey(userId));
  if (!raw) return;
  try {
    const old = JSON.parse(raw) as { id: string; amountMl: number; loggedAt: string; synced: boolean }[];
    for (const log of old) {
      put({ ...log, userId, source: 'app', deleted: false });
    }
  } catch {
    // Corrupt value: nothing to keep.
  }
  Storage.removeItemSync(legacyKey(userId));
}

export const waterLocalStore = { list, get, put, remove, readConfig, writeConfig, migrateLegacy };
