import { formatMealTime, maskTime, mealsOn, toMealTime } from '../dietRules';
import type { DietMeal } from '../dietTypes';

const meal = (id: string, planDate: string, mealTime: string | null, position: number, academyId = 'a1'): DietMeal => ({
  id,
  academyId,
  planDate,
  position,
  name: id,
  mealTime,
  description: '',
});

describe('diet rules', () => {
  it('orders a day by time, meals without time last, then by position', () => {
    const meals = [
      meal('jantar', '2026-11-10', '19:00', 0),
      meal('extra', '2026-11-10', null, 1),
      meal('cafe', '2026-11-10', '07:30', 2),
      meal('outro-dia', '2026-11-11', '08:00', 0),
      meal('sem-hora', '2026-11-10', null, 0),
    ];
    expect(mealsOn(meals, '2026-11-10').map((m) => m.id)).toEqual(['cafe', 'jantar', 'sem-hora', 'extra']);
  });

  it('filters by academy when asked', () => {
    const meals = [meal('a', '2026-11-10', null, 0, 'a1'), meal('b', '2026-11-10', null, 0, 'a2')];
    expect(mealsOn(meals, '2026-11-10', 'a2').map((m) => m.id)).toEqual(['b']);
  });

  it('formats and masks times', () => {
    expect(toMealTime('07:30:00')).toBe('07:30');
    expect(toMealTime(null)).toBeNull();
    expect(formatMealTime('07:30')).toBe('7h30');
    expect(formatMealTime('12:00')).toBe('12h');
    expect(maskTime('0730')).toBe('07:30');
    expect(maskTime('7')).toBe('7');
  });
});
