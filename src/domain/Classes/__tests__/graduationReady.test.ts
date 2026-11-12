import { readyToGraduate } from '../classesRules';
import type { ModalityBelt, ModalityStats } from '../classesTypes';

const belt = (id: string, modalityId: string, position: number, classesRequired: number | null): ModalityBelt => ({
  id,
  modalityId,
  primary: 'blue',
  tip: null,
  position,
  classesRequired,
});
const stat = (membershipId: string, modalityId: string, beltId: string | null, sinceBelt: number): ModalityStats => ({
  membershipId,
  userId: `u-${membershipId}`,
  modalityId,
  beltId,
  beltAwardedAt: beltId ? '2026-01-01T00:00:00Z' : null,
  confirmedTotal: sinceBelt,
  confirmedSinceBelt: sinceBelt,
});

describe('readyToGraduate', () => {
  const belts = [belt('white', 'bjj', 0, 10), belt('blue', 'bjj', 1, 40), belt('purple', 'bjj', 2, 60), belt('mt1', 'mt', 0, null)];
  const linked = () => true;

  it('lists who reached the next belt goal, with the next belt', () => {
    const ready = readyToGraduate([stat('a', 'bjj', 'white', 40)], belts, linked);
    expect(ready).toEqual([
      { membershipId: 'a', userId: 'u-a', modalityId: 'bjj', nextBelt: belts[1], done: 40, required: 40 },
    ]);
  });

  it('uses the first belt for a student without belt', () => {
    expect(readyToGraduate([stat('a', 'bjj', null, 10)], belts, linked)[0]?.nextBelt.id).toBe('white');
    expect(readyToGraduate([stat('a', 'bjj', null, 9)], belts, linked)).toEqual([]);
  });

  it('skips the last belt and belts without a number of classes', () => {
    expect(readyToGraduate([stat('a', 'bjj', 'purple', 500)], belts, linked)).toEqual([]);
    expect(readyToGraduate([stat('a', 'mt', null, 500)], belts, linked)).toEqual([]);
  });

  it('keeps only students linked to the modality', () => {
    const ready = readyToGraduate(
      [stat('a', 'bjj', 'white', 50), stat('b', 'bjj', 'white', 50)],
      belts,
      (membershipId) => membershipId === 'b',
    );
    expect(ready.map((r) => r.membershipId)).toEqual(['b']);
  });

  it('puts the most classes over the goal first', () => {
    const ready = readyToGraduate([stat('a', 'bjj', 'white', 41), stat('b', 'bjj', null, 25), stat('c', 'bjj', 'blue', 60)], belts, linked);
    expect(ready.map((r) => r.membershipId)).toEqual(['b', 'a', 'c']);
  });
});
