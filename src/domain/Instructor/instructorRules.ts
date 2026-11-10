import { WEEK_ORDER } from '@domain/Classes/classesRules';
import type { ClassSchedule, Modality, Weekday } from '@domain/Classes/classesTypes';

import type { InstructorSchedule } from './instructorTypes';

export const BIO_MAX = 160;

/** One time of a modality the person teaches, on its weekdays (Monday first). */
export interface TeachingSlot {
  startTime: string;
  days: Weekday[];
  scheduleIds: string[];
}

export interface TeachingGroup {
  modality: Modality;
  slots: TeachingSlot[];
}

/**
 * "Aulas que dá": the person's classes grouped by modality (academy order),
 * then by time (earliest first) with the weekdays of that time.
 */
export function teachingGroups(schedules: InstructorSchedule[], modalities: Modality[]): TeachingGroup[] {
  const groups: TeachingGroup[] = [];
  for (const modality of modalities) {
    const own = schedules.filter((s) => s.modalityId === modality.id);
    if (own.length === 0) continue;
    const byTime = new Map<string, TeachingSlot>();
    for (const s of own) {
      const slot = byTime.get(s.startTime) ?? { startTime: s.startTime, days: [], scheduleIds: [] };
      if (!slot.days.includes(s.weekday)) slot.days.push(s.weekday);
      slot.scheduleIds.push(s.id);
      byTime.set(s.startTime, slot);
    }
    const slots = [...byTime.values()]
      .map((slot) => ({ ...slot, days: [...slot.days].sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b)) }))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    groups.push({ modality, slots });
  }
  return groups;
}

/** The person's schedules in the shape nextClass() takes. */
export function asClassSchedules(
  academyId: string,
  instructorId: string,
  schedules: InstructorSchedule[],
  modalities: Modality[],
): ClassSchedule[] {
  return schedules.map((s) => ({
    id: s.id,
    academyId,
    weekday: s.weekday,
    startTime: s.startTime,
    modalityId: s.modalityId,
    modality: modalities.find((m) => m.id === s.modalityId)?.name ?? '',
    active: true,
    instructorId,
  }));
}
