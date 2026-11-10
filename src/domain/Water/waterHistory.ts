import type { LocalDate } from '@domain/Classes/classesTypes';

export interface WaterDayTotal {
  day: LocalDate;
  totalMl: number;
  /** Goal of that day; null = unknown (no weight). */
  goalMl: number | null;
  isLimit?: boolean;
}

/**
 * Merges the server's per-day totals with the device's (logs not synced yet,
 * the widget): per day, the larger total wins; the goal comes from the server
 * row, else from `goalFor`.
 */
export function mergeWaterDays(
  server: WaterDayTotal[],
  local: { day: LocalDate; totalMl: number }[],
  goalFor: (day: LocalDate) => number | null,
  isLimitFor: (day: LocalDate) => boolean = () => false,
): WaterDayTotal[] {
  const byDay = new Map<LocalDate, WaterDayTotal>();
  for (const d of server) byDay.set(d.day, { ...d });
  for (const d of local) {
    const row = byDay.get(d.day);
    if (row) row.totalMl = Math.max(row.totalMl, d.totalMl);
    else byDay.set(d.day, { day: d.day, totalMl: d.totalMl, goalMl: goalFor(d.day), isLimit: isLimitFor(d.day) });
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}
