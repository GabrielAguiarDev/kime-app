import type { Modality } from '@domain/Classes/classesTypes';

import { teachingGroups } from '../instructorRules';
import type { InstructorSchedule } from '../instructorTypes';

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
