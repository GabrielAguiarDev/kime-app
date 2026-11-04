import type { WaterLog } from './waterTypes';

/** Synced logs older than this are dropped from the device; the server keeps them. */
export const LOCAL_RETENTION_DAYS = 7;

/** Bottle presets offered as selection cards (11.5); anything else is "Outro". */
export const BOTTLE_PRESETS = [300, 500, 750, 1000] as const;
/** Same limits as profiles.bottle_ml in the database. */
export const BOTTLE_MIN_ML = 50;
export const BOTTLE_MAX_ML = 5000;
/** Form limits (the database accepts a wider range). */
export const WEIGHT_RANGE_KG = { min: 20, max: 300 } as const;
export const HEIGHT_RANGE_CM = { min: 80, max: 250 } as const;

export function isValidBottle(ml: number): boolean {
  return Number.isInteger(ml) && ml >= BOTTLE_MIN_ML && ml <= BOTTLE_MAX_ML;
}

/** "70,5" or "70.5" → 70.5; anything else → null. */
export function parseDecimal(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/** Local calendar day (YYYY-MM-DD) of an instant in an IANA time zone. */
export function localDate(at: string | Date, timeZone: string): string {
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) {
    // en-CA formats as YYYY-MM-DD.
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    dayFormatters.set(timeZone, formatter);
  }
  return formatter.format(typeof at === 'string' ? new Date(at) : at);
}

/** Logs that count on `day` (not undone), oldest first. */
export function logsOfDay(logs: WaterLog[], day: string, timeZone: string): WaterLog[] {
  return logs
    .filter((log) => !log.deleted && localDate(log.loggedAt, timeZone) === day)
    .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
}

export function totalMl(logs: WaterLog[]): number {
  return logs.reduce((sum, log) => sum + log.amountMl, 0);
}

/** The log "Desfazer" removes: the latest of the day, from the app or the widget. */
export function lastLogOfDay(logs: WaterLog[], day: string, timeZone: string): WaterLog | null {
  const ofDay = logsOfDay(logs, day, timeZone);
  return ofDay[ofDay.length - 1] ?? null;
}

/** To send with upsert: new or changed on the device and not undone. */
export function pendingUpserts(logs: WaterLog[]): WaterLog[] {
  return logs.filter((log) => !log.synced && !log.deleted);
}

/** To delete on the server (undone). Deleting an id the server never got is harmless. */
export function pendingDeletes(logs: WaterLog[]): WaterLog[] {
  return logs.filter((log) => log.deleted);
}

/** Keeps every pending log and synced logs inside the retention window. */
export function pruneLogs(logs: WaterLog[], now: Date): WaterLog[] {
  const cutoff = now.getTime() - LOCAL_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return logs.filter((log) => !log.synced || log.deleted || new Date(log.loggedAt).getTime() >= cutoff);
}

/**
 * Server logs missing on the device (reinstall, another phone), as synced
 * logs. Ids the device knows — including undone ones waiting for deletion —
 * are never brought back.
 */
export function remoteLogsToAdd(local: WaterLog[], remote: WaterLog[]): WaterLog[] {
  const known = new Set(local.map((log) => log.id));
  return remote.filter((log) => !known.has(log.id)).map((log) => ({ ...log, synced: true, deleted: false }));
}

/** The day's goal was crossed by the last change (feedback sheet moment). */
export function crossedGoal(beforeMl: number, afterMl: number, goalMl: number | null): boolean {
  return goalMl !== null && goalMl > 0 && beforeMl < goalMl && afterMl >= goalMl;
}
