import { randomUUID } from 'expo-crypto';

import { toAppError } from '@infra/supabase';
import { sharedStore } from '@infra/widget';

import { waterApi } from './waterApi';
import { waterLocalStore } from './waterLocalStore';
import {
  lastLogOfDay,
  localDate,
  logsOfDay,
  pendingDeletes,
  pendingUpserts,
  pruneLogs,
  remoteLogsToAdd,
  totalMl,
} from './waterRules';
import type { WaterDay, WaterLog, WaterWidgetConfig } from './waterTypes';

/** How far back the server is read to restore today's logs (covers any time zone). */
const PULL_WINDOW_MS = 48 * 60 * 60 * 1000;

function readLogs(userId: string): WaterLog[] {
  waterLocalStore.migrateLegacy(userId);
  return waterLocalStore.list(userId);
}

/** Today in the profile time zone, from the shared storage (works offline, includes widget logs). */
function day(userId: string, timeZone: string, now = new Date()): WaterDay {
  const date = localDate(now, timeZone);
  const logs = logsOfDay(readLogs(userId), date, timeZone);
  return { date, logs, totalMl: totalMl(logs) };
}

/** Device first: saved (and the widget refreshed) before any network call. */
function log(userId: string, amountMl: number): WaterLog {
  const entry: WaterLog = {
    id: randomUUID(),
    userId,
    amountMl,
    loggedAt: new Date().toISOString(),
    source: 'app',
    synced: false,
    deleted: false,
  };
  waterLocalStore.put(entry);
  sharedStore.reloadWidgets();
  return entry;
}

/**
 * Undoes the day's latest log (app or widget). Always a tombstone (`deleted`),
 * never a removed key: a sync already sending this log must not bring it back.
 * The next sync deletes the server copy (harmless if it never got there).
 */
function undoLast(userId: string, timeZone: string): WaterLog | null {
  const last = lastLogOfDay(readLogs(userId), localDate(new Date(), timeZone), timeZone);
  if (!last) return null;
  waterLocalStore.put({ ...last, deleted: true });
  sharedStore.reloadWidgets();
  return last;
}

/** Widget config as last published (fallback while the profile is not loaded, e.g. offline). */
function readConfig(): WaterWidgetConfig | null {
  return waterLocalStore.readConfig();
}

/** What the widgets need; null on sign-out (the widget then asks to open the app). */
function publishConfig(config: WaterWidgetConfig | null): void {
  const current = waterLocalStore.readConfig();
  if (JSON.stringify(current) === JSON.stringify(config)) return;
  waterLocalStore.writeConfig(config);
  sharedStore.reloadWidgets();
}

// One sync at a time per user. A trigger during a run (a new log) asks for
// one more pass, so nothing waits for the next foreground.
const inFlight = new Map<string, Promise<void>>();
const rerun = new Set<string>();

/**
 * Sends undone logs (delete) and new ones (upsert by id) — including the ones
 * the widget wrote while the app was closed — then restores server logs
 * missing on the device. Safe to call often; failures keep logs pending.
 */
function sync(userId: string): Promise<void> {
  const running = inFlight.get(userId);
  if (running) {
    rerun.add(userId);
    return running;
  }

  const run = (async () => {
    do {
      rerun.delete(userId);
      await syncOnce(userId);
    } while (rerun.has(userId));
  })().finally(() => {
    inFlight.delete(userId);
    rerun.delete(userId);
  });

  inFlight.set(userId, run);
  return run;
}

async function syncOnce(userId: string): Promise<void> {
  try {
    const local = readLogs(userId);

    const deletes = pendingDeletes(local);
    if (deletes.length > 0) {
      await waterApi.remove(deletes.map((d) => d.id));
      deletes.forEach((d) => waterLocalStore.remove(d.id));
    }

    const upserts = pendingUpserts(local);
    if (upserts.length > 0) {
      await waterApi.upsert(userId, upserts);
      // Re-read each one: it may have been undone while the request was in
      // flight (keep the tombstone, now known to the server) or the widget
      // may have added others (not touched: they go in the next pass).
      upserts.forEach((sent) => {
        const current = waterLocalStore.get(sent.id);
        if (current) waterLocalStore.put({ ...current, synced: true });
      });
    }

    const since = new Date(Date.now() - PULL_WINDOW_MS).toISOString();
    const remote = (await waterApi.listSince(userId, since)).map(
      (row): WaterLog => ({
        id: row.id,
        userId,
        amountMl: row.amount_ml,
        loggedAt: new Date(row.logged_at).toISOString(),
        source: 'app',
        synced: true,
        deleted: false,
      }),
    );
    const afterPush = readLogs(userId);
    remoteLogsToAdd(afterPush, remote).forEach((r) => waterLocalStore.put(r));

    // Retention: old synced logs leave the device (the server keeps them).
    const all = readLogs(userId);
    const kept = new Set(pruneLogs(all, new Date()).map((l) => l.id));
    all.filter((l) => !kept.has(l.id)).forEach((l) => waterLocalStore.remove(l.id));
  } catch (e) {
    throw toAppError(e);
  } finally {
    sharedStore.reloadWidgets();
  }
}

export const waterService = { day, log, undoLast, readConfig, publishConfig, sync };
