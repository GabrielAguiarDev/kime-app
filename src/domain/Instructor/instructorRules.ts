import { WEEK_ORDER } from '@domain/Classes/classesRules';
import type { ClassSchedule, Modality, Weekday } from '@domain/Classes/classesTypes';

import type { InstructorSchedule } from './instructorTypes';

export const BIO_MAX = 160;

/** "@Prof.Ana", "instagram.com/prof.ana/" → "prof.ana" (the database stores it like this). */
export function normalizeInstagram(text: string): string {
  return text
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '')
    .replace(/[/?#].*$/, '')
    .replace(/^@+/, '')
    .toLowerCase();
}

export function isValidInstagram(handle: string): boolean {
  return /^[a-z0-9._]{1,30}$/.test(handle);
}

/**
 * Digits with the country code (wa.me format). A Brazilian number typed with
 * the area code only (10 or 11 digits) gets 55 in front.
 */
export function normalizeWhatsapp(text: string): string {
  const digits = text.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

export function isValidWhatsapp(digits: string): boolean {
  return /^[0-9]{12,15}$/.test(digits);
}

/** "+55 11 99999-0000" for a Brazilian number; other countries: "+" and the digits. */
export function formatWhatsapp(digits: string): string {
  const br = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digits);
  return br ? `+55 ${br[1]} ${br[2]}-${br[3]}` : `+${digits}`;
}

export const instagramUrl = (handle: string) => `https://instagram.com/${handle}`;
export const whatsappUrl = (digits: string) => `https://wa.me/${digits}`;

/**
 * Time in the academy, as a number card: whole years, or months under one
 * year ("3 meses de academia"). Months are calendar months completed.
 */
export function tenure(memberSince: string, now = new Date()): { value: number; label: string } {
  const since = new Date(memberSince);
  let months = (now.getFullYear() - since.getFullYear()) * 12 + (now.getMonth() - since.getMonth());
  if (now.getDate() < since.getDate()) months -= 1;
  months = Math.max(0, months);
  if (months < 12) return { value: months, label: months === 1 ? 'Mês de academia' : 'Meses de academia' };
  const years = Math.floor(months / 12);
  return { value: years, label: years === 1 ? 'Ano de academia' : 'Anos de academia' };
}

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
