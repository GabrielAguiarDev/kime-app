import {
  annualDiscountLabel,
  defaultPlanCode,
  formatBrl,
  monthlyPriceFor,
  studentLimitLabel,
  type Plan,
} from '../plans';
import { plansAdapter } from '../plansAdapter';
import type { PlanRowApi } from '../plansApi';
import {
  isValidAcademyName,
  isValidModalitySelection,
  JIU_JITSU_ADULT_BELTS,
  suggestedBelts,
  toSetupModalities,
  usesBeltsByDefault,
} from '../signupRules';

/** Rows as list_public_plans returns them (cents, percent). */
const ROWS: PlanRowApi[] = [
  {
    code: 'starter',
    name: 'Essencial',
    monthly_price_cents: 9900,
    annual_discount_pct: 20,
    student_limit: 50,
    benefits: ['Presença por check-in', 'Horários e modalidades'],
    trial_days: 14,
    is_popular: false,
  },
  {
    code: 'pro',
    name: 'Profissional',
    monthly_price_cents: 17900,
    annual_discount_pct: 20,
    student_limit: 150,
    benefits: ['Tudo do Essencial', 'Faixas e graduações'],
    trial_days: 14,
    is_popular: true,
  },
  {
    code: 'elite',
    name: 'Elite',
    monthly_price_cents: 29990,
    annual_discount_pct: 0,
    student_limit: null,
    benefits: [],
    trial_days: 0,
    is_popular: false,
  },
];
const PLANS: Plan[] = ROWS.map(plansAdapter.toPlan);

describe('plans (catalog from the database)', () => {
  it('adapter converts cents to reais and percent to a fraction', () => {
    expect(PLANS[1]).toEqual({
      code: 'pro',
      name: 'Profissional',
      monthlyPrice: 179,
      annualDiscount: 0.2,
      studentLimit: 150,
      benefits: ['Tudo do Essencial', 'Faixas e graduações'],
      trialDays: 14,
      popular: true,
    });
    expect(PLANS[2]!.monthlyPrice).toBe(299.9);
    expect(PLANS[2]!.studentLimit).toBeNull();
  });

  it('default plan: the popular one, else the first, null without plans', () => {
    expect(defaultPlanCode(PLANS)).toBe('pro');
    expect(defaultPlanCode(PLANS.map((p) => ({ ...p, popular: false })))).toBe('starter');
    expect(defaultPlanCode([])).toBeNull();
  });

  it("annual price uses the plan's own discount", () => {
    const pro = PLANS[1]!;
    expect(monthlyPriceFor(pro, 'monthly')).toBe(179);
    expect(monthlyPriceFor(pro, 'annual')).toBe(143.2);
    expect(monthlyPriceFor(PLANS[2]!, 'annual')).toBe(299.9);
  });

  it('annual discount label, none at 0%', () => {
    expect(annualDiscountLabel(PLANS[0]!)).toBe('-20%');
    expect(annualDiscountLabel(PLANS[2]!)).toBeNull();
  });

  it('formats prices and limits', () => {
    expect(formatBrl(179)).toBe('R$ 179');
    expect(formatBrl(143.2)).toBe('R$ 143,20');
    expect(studentLimitLabel(PLANS[0]!)).toBe('Até 50 alunos');
    expect(studentLimitLabel(PLANS[2]!)).toBe('Alunos ilimitados');
  });
});

describe('sign-up modalities', () => {
  it('only Jiu-jitsu (using belts) gets the adult belts, without class counts', () => {
    expect(suggestedBelts('Jiu-jitsu', true)).toEqual(JIU_JITSU_ADULT_BELTS);
    expect(suggestedBelts('Jiu-Jitsu', false)).toEqual([]);
    expect(suggestedBelts('Judô', true)).toEqual([]);
    expect(toSetupModalities([{ name: ' Jiu-jitsu ', usesBelts: true }, { name: 'Muay Thai', usesBelts: false }])).toEqual([
      {
        name: 'Jiu-jitsu',
        uses_belts: true,
        belts: ['white', 'blue', 'purple', 'brown', 'black'].map((primary_color) => ({ primary_color, tip_color: null })),
      },
      { name: 'Muay Thai', uses_belts: false, belts: [] },
    ]);
  });

  it('belted martial arts start with "Usa faixas" on', () => {
    expect(usesBeltsByDefault('Jiu-jitsu')).toBe(true);
    expect(usesBeltsByDefault('Karatê')).toBe(true);
    expect(usesBeltsByDefault('Muay Thai')).toBe(false);
    expect(usesBeltsByDefault('Boxe')).toBe(false);
  });

  it('validates the selection like the server', () => {
    expect(isValidModalitySelection([])).toBe(false);
    expect(isValidModalitySelection([{ name: 'Boxe', usesBelts: false }])).toBe(true);
    expect(isValidModalitySelection([{ name: 'Boxe', usesBelts: false }, { name: ' boxe', usesBelts: false }])).toBe(false);
    expect(isValidModalitySelection([{ name: '   ', usesBelts: false }])).toBe(false);
  });

  it('academy name needs 2 to 80 characters', () => {
    expect(isValidAcademyName(' K ')).toBe(false);
    expect(isValidAcademyName('Kimi')).toBe(true);
    expect(isValidAcademyName('x'.repeat(81))).toBe(false);
  });
});
