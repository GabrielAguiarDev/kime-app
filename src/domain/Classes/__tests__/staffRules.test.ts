import { attendanceCounts, nextClass, nowTimeIn, startsInLabel } from '../staffRules';
import type { ClassSchedule } from '../classesTypes';

const s = (id: string, weekday: ClassSchedule['weekday'], startTime: string): ClassSchedule => ({
  id,
  academyId: 'a',
  weekday,
  startTime,
  modalityId: 'm',
  modality: 'Jiu-Jitsu',
  active: true,
});

// 2026-11-10 is a Tuesday.
const schedules = [s('tue7', 2, '07:00'), s('tue19', 2, '19:00'), s('thu19', 4, '19:00')];

describe('nextClass', () => {
  it('in progress for an hour after it starts', () => {
    expect(nextClass(schedules, '2026-11-10', '19:30')).toMatchObject({ schedule: { id: 'tue19' }, status: 'live' });
  });

  it('the next one today, with the minutes left', () => {
    expect(nextClass(schedules, '2026-11-10', '18:20')).toMatchObject({ schedule: { id: 'tue19' }, status: 'soon', minutesUntil: 40 });
  });

  it('none left today: the next one this week', () => {
    expect(nextClass(schedules, '2026-11-10', '20:30')).toMatchObject({
      schedule: { id: 'thu19' },
      date: '2026-11-12',
      status: 'later',
    });
  });

  it('no schedules', () => {
    expect(nextClass([], '2026-11-10', '10:00')).toBeNull();
  });
});

describe('labels and counts', () => {
  it('starts in', () => {
    expect(startsInLabel({ status: 'soon', minutesUntil: 40 })).toBe('Começa em 40 min');
    expect(startsInLabel({ status: 'soon', minutesUntil: 75 })).toBe('Começa em 1 h 15 min');
    expect(startsInLabel({ status: 'live', minutesUntil: 0 })).toBe('Em andamento');
  });

  it('counts confirmed and pending of one class', () => {
    expect(
      attendanceCounts(
        [
          { scheduleId: 'a', status: 'confirmed' },
          { scheduleId: 'a', status: 'pending' },
          { scheduleId: 'a', status: 'rejected' },
          { scheduleId: 'b', status: 'pending' },
        ],
        'a',
      ),
    ).toEqual({ confirmed: 1, pending: 1 });
  });

  it('now in the academy time zone', () => {
    expect(nowTimeIn('America/Sao_Paulo', new Date('2026-11-10T21:05:00Z'))).toBe('18:05');
  });
});
