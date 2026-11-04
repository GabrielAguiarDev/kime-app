import { WEEK_ORDER } from './classesRules';
import type { ClassSchedule, Weekday } from './classesTypes';

/**
 * The database keeps one class_schedules row per weekday (check-ins point at
 * it). Staff manage them as a "class group": one time + modality on several
 * weekdays. Modalities are registered rows, so groups key on the modality id.
 */
export interface ScheduleGroup {
  key: string;
  startTime: string;
  modalityId: string;
  /** Modality name (display). */
  modality: string;
  /** Weekdays with an active row, Monday first. */
  days: Weekday[];
  /** Every row of the group, active or not. */
  schedules: ClassSchedule[];
  /** At least one active weekday. */
  active: boolean;
}

export function groupKey(startTime: string, modalityId: string): string {
  return `${startTime}|${modalityId}`;
}

const byWeekOrder = (a: Weekday, b: Weekday) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b);

export function groupSchedules(schedules: ClassSchedule[]): ScheduleGroup[] {
  const groups = new Map<string, ScheduleGroup>();
  for (const s of schedules) {
    const key = groupKey(s.startTime, s.modalityId);
    const group = groups.get(key) ?? {
      key,
      startTime: s.startTime,
      modalityId: s.modalityId,
      modality: s.modality,
      days: [],
      schedules: [],
      active: false,
    };
    group.schedules.push(s);
    if (s.active) {
      group.active = true;
      if (!group.days.includes(s.weekday)) group.days.push(s.weekday);
    }
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, days: [...g.days].sort(byWeekOrder) }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.modality.localeCompare(b.modality, 'pt-BR'));
}

/** Weekdays of a group as shown on its card: active days, or every day when inactive. */
export function groupDisplayDays(group: ScheduleGroup): Weekday[] {
  if (group.active) return group.days;
  return [...new Set(group.schedules.map((s) => s.weekday))].sort(byWeekOrder);
}

export interface ScheduleGroupPlan {
  /** Weekdays that need a new row. */
  create: Weekday[];
  /** Rows to move to the target time/modality (and keep active). */
  retime: string[];
  /** Rows to switch on. */
  activate: string[];
  /** Rows to switch off. Never deleted: check-ins reference them. */
  deactivate: string[];
}

/**
 * What to write so that `startTime` + `modalityId` runs exactly on `days`.
 * `editing` is the group being edited (empty for a new one). Rows already
 * saved with the target time/modality are reused (a new group that matches an
 * existing one merges into it); an unchecked day is deactivated, not deleted.
 */
export function planScheduleGroup(
  all: ClassSchedule[],
  editing: ClassSchedule[],
  startTime: string,
  modalityId: string,
  days: Weekday[],
): ScheduleGroupPlan {
  const target = groupKey(startTime, modalityId);
  const pool = new Map<string, ClassSchedule>();
  for (const s of [...editing, ...all.filter((s) => groupKey(s.startTime, s.modalityId) === target)]) {
    pool.set(s.id, s);
  }
  const plan: ScheduleGroupPlan = { create: [], retime: [], activate: [], deactivate: [] };

  for (const day of WEEK_ORDER) {
    const rows = [...pool.values()].filter((s) => s.weekday === day);
    if (!days.includes(day)) {
      for (const s of rows) if (s.active) plan.deactivate.push(s.id);
      continue;
    }
    // Prefer a row already at the target, then an active one.
    const score = (s: ClassSchedule) =>
      (groupKey(s.startTime, s.modalityId) === target ? 2 : 0) + (s.active ? 1 : 0);
    const chosen = [...rows].sort((a, b) => score(b) - score(a))[0];
    if (!chosen) {
      plan.create.push(day);
    } else if (groupKey(chosen.startTime, chosen.modalityId) !== target) {
      plan.retime.push(chosen.id);
    } else if (!chosen.active) {
      plan.activate.push(chosen.id);
    }
    for (const s of rows) if (s !== chosen && s.active) plan.deactivate.push(s.id);
  }
  return plan;
}
