import { autoDailyGoalMl, dailyGoal, ML_PER_KG } from '../waterGoal';

describe('daily water goal', () => {
  it('is 35 ml per kg', () => {
    expect(ML_PER_KG).toBe(35);
    expect(autoDailyGoalMl(70)).toBe(2450);
    expect(autoDailyGoalMl(72.4)).toBe(2534);
  });

  it('needs a weight', () => {
    expect(autoDailyGoalMl(null)).toBeNull();
    expect(dailyGoal({ weightKg: null })).toEqual({ goalMl: null, source: null });
  });

  it("a professor's plan for today replaces the automatic goal (phase 4)", () => {
    expect(dailyGoal({ weightKg: 70 })).toEqual({ goalMl: 2450, source: 'auto' });
    expect(dailyGoal({ weightKg: 70, plannedMl: 4000 })).toEqual({ goalMl: 4000, source: 'plan' });
    expect(dailyGoal({ weightKg: null, plannedMl: 4000 })).toEqual({ goalMl: 4000, source: 'plan' });
  });
});
