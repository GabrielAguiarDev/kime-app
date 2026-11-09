import { beltEnvironment, graduationTrail, sectionStops, stopSizes } from '../graduationTrail';
import type { ModalityBelt } from '../classesTypes';

const belt = (id: string, position: number, classesRequired: number | null): ModalityBelt => ({
  id, modalityId: 'bjj', position, classesRequired, primary: 'white', tip: null,
});

describe('stopSizes', () => {
  it('splits into at most 10 equal stops, the last one takes the rest', () => {
    expect(stopSizes(30)).toEqual(Array(10).fill(3));
    expect(stopSizes(120)).toEqual(Array(10).fill(12));
    expect(stopSizes(6)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(stopSizes(25)).toEqual([2, 2, 2, 2, 2, 2, 2, 2, 2, 7]);
    expect(stopSizes(0)).toEqual([]);
  });
});

describe('sectionStops', () => {
  it('marks done, current and future stops with kinds', () => {
    const stops = sectionStops(30, 14, 'current');
    expect(stops.slice(3, 6).map((s) => [s.from, s.to, s.state, s.doneInStop])).toEqual([
      [10, 12, 'done', 3],
      [13, 15, 'current', 2],
      [16, 18, 'future', 0],
    ]);
    expect(stops.map((s) => s.kind)).toEqual([
      'start', 'middle', 'middle', 'middle', 'middle', 'middle', 'middle', 'near', 'near', 'graduation',
    ]);
  });
  it('makes the graduation node ready when every class is done', () => {
    const stops = sectionStops(6, 6, 'current');
    expect(stops.at(-1)).toMatchObject({ state: 'ready', isGraduation: true });
    expect(stops.slice(0, -1).every((s) => s.state === 'done')).toBe(true);
  });
  it('moves to the next stop at a boundary', () => {
    expect(sectionStops(6, 2, 'current').map((s) => s.state).slice(0, 4)).toEqual(['done', 'done', 'current', 'future']);
  });
});

describe('beltEnvironment', () => {
  it('starts at Amanhecer, ends at Tempestade, spreads the middle', () => {
    expect([0, 1].map((p) => beltEnvironment(p, 2))).toEqual([1, 5]);
    expect([0, 1, 2, 3, 4].map((p) => beltEnvironment(p, 5))).toEqual([1, 2, 3, 4, 5]);
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((p) => beltEnvironment(p, 8))).toEqual([1, 2, 2, 3, 3, 4, 4, 5]);
    expect(beltEnvironment(0, 1)).toBe(1);
  });
});

describe('graduationTrail', () => {
  const belts = [belt('white', 0, null), belt('blue', 1, 30), belt('purple', 2, 40), belt('brown', 3, 50)];

  it('one section per belt, count restarting in the current one', () => {
    const trail = graduationTrail(belts, 'blue', 14);
    expect(trail.sections.map((s) => [s.number, s.state, s.required, s.done, s.isFinal])).toEqual([
      [1, 'done', 30, 30, false],
      [2, 'current', 40, 14, false],
      [3, 'future', 50, 0, false],
      [4, 'future', 0, 0, true],
    ]);
    expect(trail.currentSection).toBe(1);
    expect(trail.currentStop).toBe(3);
    expect(trail.sections[3]!.stops).toEqual([]);
  });

  it('adds an opening section when the first belt needs classes', () => {
    const trail = graduationTrail([belt('white', 0, 6), belt('blue', 1, 30)], null, 2);
    expect(trail.sections.map((s) => [s.key, s.number, s.state])).toEqual([
      ['start', 0, 'current'],
      ['white', 1, 'future'],
      ['blue', 2, 'future'],
    ]);
    expect(trail.currentStop).toBe(2);
  });

  it('final section is current at the last belt', () => {
    const trail = graduationTrail(belts, 'brown', 99);
    expect(trail.currentSection).toBe(3);
    expect(trail.currentStop).toBeNull();
  });

  it('section without a goal has no stops', () => {
    const trail = graduationTrail([belt('white', 0, null), belt('blue', 1, null)], 'white', 5);
    expect(trail.sections[0]!.stops).toEqual([]);
  });
});
