import { groupDisplayDays, groupSchedules, planScheduleGroup } from '../scheduleGroups';
import type { ClassSchedule, Weekday } from '../classesTypes';

const MODALITY_IDS: Record<string, string> = { 'Muay Thai': 'mt', 'Jiu-Jitsu': 'bjj', 'No-Gi': 'nogi' };

const row = (id: string, weekday: Weekday, startTime = '19:00', modality = 'Muay Thai', active = true): ClassSchedule => ({
  id, academyId: 'a', weekday, startTime, modalityId: MODALITY_IDS[modality] ?? modality, modality, active,
});

describe('groupSchedules', () => {
  it('groups rows by time + modality with days Monday first', () => {
    const groups = groupSchedules([
      row('sun', 0), row('mon', 1), row('wed', 3), row('bjj', 2, '07:00', 'Jiu-Jitsu'), row('off', 5, '19:00', 'Muay Thai', false),
    ]);
    expect(groups.map((g) => [g.startTime, g.modality, g.days])).toEqual([
      ['07:00', 'Jiu-Jitsu', [2]],
      ['19:00', 'Muay Thai', [1, 3, 0]],
    ]);
    expect(groups[1]!.schedules).toHaveLength(4);
  });

  it('keys on the modality id and keeps fully inactive groups', () => {
    const [group] = groupSchedules([row('a', 1, '19:00', 'Muay Thai', false), row('b', 2, '19:00', 'Muay Thai', false)]);
    expect(group!.active).toBe(false);
    expect(groupDisplayDays(group!)).toEqual([1, 2]);
  });
});

describe('planScheduleGroup', () => {
  it('creates one row per selected day for a new group', () => {
    expect(planScheduleGroup([], [], '19:00', 'mt', [1, 3, 5])).toEqual({
      create: [1, 3, 5], retime: [], activate: [], deactivate: [],
    });
  });

  it('adds, reactivates and deactivates days when editing (never deletes)', () => {
    const rows = [row('mon', 1), row('tue', 2), row('fri-off', 5, '19:00', 'Muay Thai', false)];
    expect(planScheduleGroup(rows, rows, '19:00', 'mt', [1, 3, 5])).toEqual({
      create: [3], retime: [], activate: ['fri-off'], deactivate: ['tue'],
    });
  });

  it('moves the rows when the time or modality changes', () => {
    const rows = [row('mon', 1), row('wed', 3)];
    expect(planScheduleGroup(rows, rows, '20:00', 'mt', [1, 3])).toEqual({
      create: [], retime: ['mon', 'wed'], activate: [], deactivate: [],
    });
  });

  it('merges into an existing group with the same time and modality', () => {
    const existing = [row('mon', 1, '20:00'), row('wed-old', 3, '19:00')];
    const plan = planScheduleGroup(existing, [existing[1]!], '20:00', 'mt', [1, 3]);
    expect(plan).toEqual({ create: [], retime: ['wed-old'], activate: [], deactivate: [] });
  });

  it('keeps one active row per day when merging overlaps', () => {
    const existing = [row('mon-20', 1, '20:00'), row('mon-19', 1, '19:00')];
    const plan = planScheduleGroup(existing, [existing[1]!], '20:00', 'mt', [1]);
    expect(plan).toEqual({ create: [], retime: [], activate: [], deactivate: ['mon-19'] });
  });
});

describe('modality ids', () => {
  it('does not merge different modalities at the same time into one group', () => {
    const groups = groupSchedules([row('a', 1, '19:00', 'Muay Thai'), row('b', 1, '19:00', 'Jiu-Jitsu')]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.modalityId).sort()).toEqual(['bjj', 'mt']);
  });

  it('planScheduleGroup does not reuse a same-time row of another modality', () => {
    const existing = [row('mt-mon', 1, '19:00', 'Muay Thai')];
    expect(planScheduleGroup(existing, [], '19:00', 'bjj', [1])).toEqual({
      create: [1], retime: [], activate: [], deactivate: [],
    });
  });

  it('retimes a row to another modality when editing it', () => {
    const rows = [row('mt-mon', 1, '19:00', 'Muay Thai')];
    expect(planScheduleGroup(rows, rows, '19:00', 'bjj', [1])).toEqual({
      create: [], retime: ['mt-mon'], activate: [], deactivate: [],
    });
  });
});
