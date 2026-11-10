import type { Modality } from '@domain/Classes/classesTypes';
import type { InstructorProfile } from '@domain/Instructor/instructorTypes';
import { teachingGroups } from '@domain/Instructor/instructorRules';

import type { ProfileView } from './profileView';

/**
 * DEV ONLY (__DEV__): a full instructor profile to check the layout — two
 * belts, bio, classes in two modalities (the Monday 19:00 one as the
 * next class). Photo, name and role stay the real ones.
 * Never saved anywhere.
 */
const jj: Modality = { id: 'demo-jj', name: 'Jiu-Jitsu', position: 0, usesBelts: true };
const mt: Modality = { id: 'demo-mt', name: 'Muay Thai', position: 1, usesBelts: true };

export function demoView(data: InstructorProfile): ProfileView {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 6);
  return {
    bio: 'Faixa preta de Jiu-Jitsu, 15 anos de tatame. Foco em fundamentos e preparação para campeonato.',
    belts: [
      { modality: jj, belt: { primary: 'black', tip: 'red' } },
      { modality: mt, belt: { primary: 'blue', tip: null } },
    ],
    memberSince: since.toISOString(),
    groups: teachingGroups(
      [
        { id: 'demo-1', modalityId: jj.id, weekday: 1, startTime: '19:00' },
        { id: 'demo-2', modalityId: jj.id, weekday: 3, startTime: '19:00' },
        { id: 'demo-3', modalityId: jj.id, weekday: 5, startTime: '19:00' },
        { id: 'demo-4', modalityId: jj.id, weekday: 6, startTime: '10:00' },
        { id: 'demo-5', modalityId: mt.id, weekday: 2, startTime: '07:00' },
        { id: 'demo-6', modalityId: mt.id, weekday: 4, startTime: '07:00' },
      ],
      [jj, mt],
    ),
    next: { scheduleId: 'demo-1', label: 'Próxima · amanhã' },
  };
}
