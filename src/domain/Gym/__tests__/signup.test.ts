import {
  ANNUAL_DISCOUNT,
  DEFAULT_PLAN,
  formatBrl,
  monthlyPriceFor,
  PLANS,
  studentLimitLabel,
} from '../plans';
import {
  isValidAcademyName,
  isValidModalitySelection,
  JIU_JITSU_ADULT_BELTS,
  suggestedBelts,
  toSetupModalities,
  usesBeltsByDefault,
} from '../signupRules';

describe('plans (illustrative config)', () => {
  it('three plans, the middle one is the most chosen and the default', () => {
    expect(PLANS.map((p) => p.tier)).toEqual(['starter', 'pro', 'elite']);
    expect(PLANS.filter((p) => p.popular).map((p) => p.tier)).toEqual(['pro']);
    expect(DEFAULT_PLAN).toBe('pro');
    for (const p of PLANS) expect(p.benefits.length).toBeGreaterThanOrEqual(3);
  });

  it('annual price is the discounted monthly equivalent', () => {
    const pro = PLANS[1]!;
    expect(monthlyPriceFor(pro, 'monthly')).toBe(pro.monthlyPrice);
    expect(monthlyPriceFor(pro, 'annual')).toBeCloseTo(pro.monthlyPrice * (1 - ANNUAL_DISCOUNT), 2);
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
