import type { WaterLog } from './waterTypes';

/** Synced logs older than this are dropped from the device; the server keeps them. */
export const LOCAL_RETENTION_DAYS = 7;

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Total of the device's current day. */
export function totalForDay(logs: WaterLog[], day: Date): number {
  return logs.reduce((sum, log) => (sameLocalDay(new Date(log.loggedAt), day) ? sum + log.amountMl : sum), 0);
}

export function pendingLogs(logs: WaterLog[]): WaterLog[] {
  return logs.filter((log) => !log.synced);
}

export function markSynced(logs: WaterLog[], ids: readonly string[]): WaterLog[] {
  const set = new Set(ids);
  return logs.map((log) => (set.has(log.id) ? { ...log, synced: true } : log));
}

/** Keeps every unsynced log and synced logs inside the retention window. */
export function pruneLogs(logs: WaterLog[], now: Date): WaterLog[] {
  const cutoff = now.getTime() - LOCAL_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return logs.filter((log) => !log.synced || new Date(log.loggedAt).getTime() >= cutoff);
}
