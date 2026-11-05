import type { ClassSchedule } from '@domain/Classes/classesTypes';

import { planClassReminders, planSignature, zonedTime } from '../reminderRules';

const schedule = (id: string, weekday: ClassSchedule['weekday'], startTime: string, modalityId = 'jj'): ClassSchedule => ({
  id,
  academyId: 'a1',
  weekday,
  startTime,
  modalityId,
  modality: modalityId === 'jj' ? 'Jiu-Jitsu' : 'No-Gi',
  active: true,
});

describe('zonedTime', () => {
  it('converts the academy wall clock to the instant (São Paulo, UTC-3)', () => {
    expect(zonedTime('2026-11-10', '19:00', 'America/Sao_Paulo').toISOString()).toBe('2026-11-10T22:00:00.000Z');
  });

  it('handles daylight saving time', () => {
    expect(zonedTime('2026-07-01', '19:00', 'America/New_York').toISOString()).toBe('2026-07-01T23:00:00.000Z');
    expect(zonedTime('2026-12-01', '19:00', 'America/New_York').toISOString()).toBe('2026-12-02T00:00:00.000Z');
  });
});

describe('planClassReminders', () => {
  // 2026-11-10 is a Tuesday (weekday 2).
  const base = {
    today: '2026-11-10',
    timeZone: 'America/Sao_Paulo',
    academyName: 'Kimi',
    modalityIds: null,
  };

  it('reminds 1 h before each class still ahead, for the next 7 days', () => {
    const reminders = planClassReminders({
      ...base,
      schedules: [schedule('tue', 2, '19:00'), schedule('thu', 4, '07:00')],
      // 20:30 UTC = 17:30 in São Paulo: today's 19:00 reminder (18:00) is still ahead.
      now: new Date('2026-11-10T20:30:00Z'),
    });
    expect(reminders.map((r) => [r.key, r.at.toISOString()])).toEqual([
      ['tue:2026-11-10', '2026-11-10T21:00:00.000Z'],
      ['thu:2026-11-12', '2026-11-12T09:00:00.000Z'],
    ]);
    expect(reminders[0]!.body).toBe('Jiu-Jitsu às 19:00 na Kimi.');
  });

  it('skips reminders already past and other modalities', () => {
    const reminders = planClassReminders({
      ...base,
      schedules: [schedule('tue', 2, '19:00'), schedule('tue-nogi', 2, '20:00', 'ng')],
      modalityIds: new Set(['ng']),
      now: new Date('2026-11-10T21:30:00Z'),
    });
    expect(reminders.map((r) => r.key)).toEqual(['tue-nogi:2026-11-10']);
  });

  it('ignores inactive schedules and has a stable signature', () => {
    const inactive = { ...schedule('tue', 2, '19:00'), active: false };
    const plan = planClassReminders({ ...base, schedules: [inactive], now: new Date('2026-11-10T12:00:00Z') });
    expect(plan).toEqual([]);
    expect(planSignature(plan)).toBe('');
  });
});
