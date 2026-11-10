import type { Modality } from '@domain/Classes/classesTypes';

import {
  formatWhatsapp,
  isValidInstagram,
  isValidWhatsapp,
  normalizeInstagram,
  normalizeWhatsapp,
  teachingGroups,
  tenure,
} from '../instructorRules';
import type { InstructorSchedule } from '../instructorTypes';

describe('instagram', () => {
  it('keeps the handle only, in lower case', () => {
    expect(normalizeInstagram('  @Prof.Ana ')).toBe('prof.ana');
    expect(normalizeInstagram('https://www.instagram.com/Prof_Ana/?hl=pt')).toBe('prof_ana');
    expect(normalizeInstagram('instagram.com/prof.ana')).toBe('prof.ana');
  });
  it('validates the handle', () => {
    expect(isValidInstagram('prof.ana')).toBe(true);
    expect(isValidInstagram('prof ana')).toBe(false);
    expect(isValidInstagram('')).toBe(false);
    expect(isValidInstagram('a'.repeat(31))).toBe(false);
  });
});

describe('whatsapp', () => {
  it('adds 55 to a Brazilian number with the area code only', () => {
    expect(normalizeWhatsapp('(11) 99999-0000')).toBe('5511999990000');
    expect(normalizeWhatsapp('11 3333-4444')).toBe('551133334444');
    expect(normalizeWhatsapp('+55 11 99999-0000')).toBe('5511999990000');
    expect(normalizeWhatsapp('+351 912 345 678')).toBe('351912345678');
  });
  it('validates and formats', () => {
    expect(isValidWhatsapp('5511999990000')).toBe(true);
    expect(isValidWhatsapp('99990000')).toBe(false);
    expect(formatWhatsapp('5511999990000')).toBe('+55 11 99999-0000');
    expect(formatWhatsapp('351912345678')).toBe('+351912345678');
  });
});

describe('tenure', () => {
  const now = new Date(2026, 10, 10);
  it('counts months under one year', () => {
    expect(tenure(new Date(2026, 7, 10).toISOString(), now)).toEqual({ value: 3, label: 'Meses de academia' });
    expect(tenure(new Date(2026, 9, 1).toISOString(), now)).toEqual({ value: 1, label: 'Mês de academia' });
    expect(tenure(new Date(2026, 10, 9).toISOString(), now)).toEqual({ value: 0, label: 'Meses de academia' });
  });
  it('counts whole years from one year on', () => {
    expect(tenure(new Date(2025, 10, 10).toISOString(), now)).toEqual({ value: 1, label: 'Ano de academia' });
    expect(tenure(new Date(2023, 10, 11).toISOString(), now)).toEqual({ value: 2, label: 'Anos de academia' });
  });
});

describe('teachingGroups', () => {
  const modalities: Modality[] = [
    { id: 'jj', name: 'Jiu-Jitsu', position: 0, usesBelts: true },
    { id: 'mt', name: 'Muay Thai', position: 1, usesBelts: false },
    { id: 'bx', name: 'Boxe', position: 2, usesBelts: false },
  ];
  const s = (id: string, modalityId: string, weekday: InstructorSchedule['weekday'], startTime: string): InstructorSchedule => ({
    id,
    modalityId,
    weekday,
    startTime,
  });

  it('groups by modality (academy order) and time, weekdays Monday first', () => {
    const groups = teachingGroups(
      [s('a', 'mt', 2, '07:00'), s('b', 'jj', 0, '19:00'), s('c', 'jj', 1, '19:00'), s('d', 'jj', 3, '07:00'), s('e', 'mt', 4, '07:00')],
      modalities,
    );
    expect(groups.map((g) => g.modality.id)).toEqual(['jj', 'mt']);
    expect(groups[0]!.slots).toEqual([
      { startTime: '07:00', days: [3], scheduleIds: ['d'] },
      { startTime: '19:00', days: [1, 0], scheduleIds: ['b', 'c'] },
    ]);
    expect(groups[1]!.slots).toEqual([{ startTime: '07:00', days: [2, 4], scheduleIds: ['a', 'e'] }]);
  });

  it('is empty without schedules', () => {
    expect(teachingGroups([], modalities)).toEqual([]);
  });
});
