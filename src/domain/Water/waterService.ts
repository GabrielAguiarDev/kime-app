import { randomUUID } from 'expo-crypto';

import { toAppError } from '@infra/supabase';
import { sharedWidgetStorage } from '@infra/widget';

import { waterApi } from './waterApi';
import { waterLocalStore } from './waterLocalStore';
import { markSynced, pendingLogs, pruneLogs, totalForDay } from './waterRules';
import type { WaterLog } from './waterTypes';

function publishToday(userId: string, logs: WaterLog[]): number {
  const now = new Date();
  const totalMl = totalForDay(logs, now);
  sharedWidgetStorage.setWaterToday({ userId, totalMl, updatedAt: now.toISOString() });
  return totalMl;
}

/** Device first: the log is saved (and the widget updated) before any network call. */
function log(userId: string, amountMl: number): WaterLog {
  const entry: WaterLog = {
    id: randomUUID(),
    amountMl,
    loggedAt: new Date().toISOString(),
    synced: false,
  };
  const logs = [...waterLocalStore.read(userId), entry];
  waterLocalStore.write(userId, logs);
  publishToday(userId, logs);
  return entry;
}

function todayTotal(userId: string): number {
  return totalForDay(waterLocalStore.read(userId), new Date());
}

// One sync at a time per user: concurrent triggers (log + foreground) share it.
const inFlight = new Map<string, Promise<void>>();

/** Sends every unsynced log. Safe to call often; failures keep logs pending. */
function sync(userId: string): Promise<void> {
  const running = inFlight.get(userId);
  if (running) return running;

  const run = (async () => {
    const pending = pendingLogs(waterLocalStore.read(userId));
    if (pending.length === 0) return;
    try {
      await waterApi.upsert(userId, pending);
    } catch (e) {
      throw toAppError(e);
    }
    // Re-read: new logs may have been added while the request was in flight.
    const synced = markSynced(waterLocalStore.read(userId), pending.map((p) => p.id));
    const pruned = pruneLogs(synced, new Date());
    waterLocalStore.write(userId, pruned);
    publishToday(userId, pruned);
  })().finally(() => inFlight.delete(userId));

  inFlight.set(userId, run);
  return run;
}

export const waterService = { log, todayTotal, sync };
