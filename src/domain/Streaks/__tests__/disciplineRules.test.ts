import { parseDiscipline, weekProgress, weekProgressText, weeksLabel } from '../disciplineRules';

const raw = {
  today: '2026-11-11',
  week_start: '2026-11-09',
  current: 3,
  record: 5,
  freezes: 1,
  week_done: false,
  days: [
    { day: '2026-11-09', water: 'done', confirmed: 1, pending: 0 },
    { day: '2026-11-10', water: 'done', confirmed: 0, pending: 1 },
    { day: '2026-11-11', water: 'over', confirmed: 0, pending: 0 },
    { day: '2026-11-12', water: 'weird', confirmed: 0, pending: 0 },
  ],
  weeks: [
    { week_start: '2026-10-26', state: 'frozen' },
    { week_start: '2026-11-02', state: 'done' },
  ],
};

describe('parseDiscipline', () => {
  it('reads the my_discipline JSON', () => {
    const d = parseDiscipline(raw)!;
    expect(d).toMatchObject({ today: '2026-11-11', weekStart: '2026-11-09', current: 3, record: 5, freezes: 1, weekDone: false });
    expect(d.weeks).toEqual([
      { weekStart: '2026-10-26', state: 'frozen' },
      { weekStart: '2026-11-02', state: 'done' },
    ]);
  });

  it('unknown water states never count as met', () => {
    expect(parseDiscipline(raw)!.days[3]!.water).toBe('unconfigured');
  });

  it('no data, no discipline', () => {
    expect(parseDiscipline(null)).toBeNull();
  });
});

describe('week progress', () => {
  it('counts water days met and confirmed classes; pending apart', () => {
    expect(weekProgress(parseDiscipline(raw)!)).toEqual({ waterDays: 2, classes: 1, pending: 1 });
  });

  it('"Água 2/5 · Treino 1/1", capped at the targets', () => {
    expect(weekProgressText(parseDiscipline(raw)!)).toBe('Água 2/5 · Treino 1/1');
    const full = { days: Array.from({ length: 7 }, (_, i) => ({ day: `d${i}`, water: 'done' as const, confirmed: 2, pending: 0 })) };
    expect(weekProgressText(full)).toBe('Água 5/5 · Treino 1/1');
  });

  it('weeks label', () => {
    expect(weeksLabel(1)).toBe('1 semana');
    expect(weeksLabel(4)).toBe('4 semanas');
  });
});
