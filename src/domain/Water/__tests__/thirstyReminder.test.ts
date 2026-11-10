import { planThirstyReminders } from '../thirstyReminder';

const TZ = 'America/Sao_Paulo';
// 2026-11-10 12:00 in São Paulo (UTC-3).
const NOON = new Date('2026-11-10T15:00:00.000Z');

describe('planThirstyReminders', () => {
  it('schedules 18:00 local for today and the next days', () => {
    const plan = planThirstyReminders({ now: NOON, timeZone: TZ, todayTotalMl: 0, limitsByDate: {}, days: 3 });
    expect(plan.map((d) => d.toISOString())).toEqual([
      '2026-11-10T21:00:00.000Z',
      '2026-11-11T21:00:00.000Z',
      '2026-11-12T21:00:00.000Z',
    ]);
  });

  it('skips today once water was logged', () => {
    const plan = planThirstyReminders({ now: NOON, timeZone: TZ, todayTotalMl: 500, limitsByDate: {}, days: 2 });
    expect(plan.map((d) => d.toISOString())).toEqual(['2026-11-11T21:00:00.000Z']);
  });

  it('skips today after 18:00', () => {
    const evening = new Date('2026-11-10T22:00:00.000Z');
    const plan = planThirstyReminders({ now: evening, timeZone: TZ, todayTotalMl: 0, limitsByDate: {}, days: 2 });
    expect(plan.map((d) => d.toISOString())).toEqual(['2026-11-11T21:00:00.000Z']);
  });

  it('skips limit days of the water plan', () => {
    const plan = planThirstyReminders({
      now: NOON,
      timeZone: TZ,
      todayTotalMl: 0,
      limitsByDate: { '2026-11-10': true, '2026-11-12': true },
      days: 3,
    });
    expect(plan.map((d) => d.toISOString())).toEqual(['2026-11-11T21:00:00.000Z']);
  });
});
