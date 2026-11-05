/**
 * Academy plans shown in the sign-up (step 1). ILLUSTRATIVE ONLY: there is no
 * billing yet ("Cobrança ainda não ativa nesta versão"). Every value the user
 * may want to tune lives here: names, prices, student limits, benefits, the
 * annual discount and the trial length.
 *
 * `tier` is what gets saved on the academy (academies.plan_tier) for when
 * subscriptions exist; keep it in sync with the check in
 * supabase/migrations/20261105150000_academy_signup.sql.
 */
export type PlanTier = 'starter' | 'pro' | 'elite';
export type BillingPeriod = 'monthly' | 'annual';

export interface Plan {
  tier: PlanTier;
  name: string;
  /** Monthly price in BRL when billed monthly. */
  monthlyPrice: number;
  /** Null = unlimited. */
  studentLimit: number | null;
  benefits: string[];
  /** "Mais escolhido" badge. */
  popular?: boolean;
}

/** Annual billing: this share off the monthly price. */
export const ANNUAL_DISCOUNT = 0.2;

/** Free trial before the first charge (when billing exists). */
export const TRIAL_DAYS = 14;

export const PLANS: Plan[] = [
  {
    tier: 'starter',
    name: 'Essencial',
    monthlyPrice: 99,
    studentLimit: 50,
    benefits: ['Presença por check-in', 'Horários e modalidades', 'Timer de rounds'],
  },
  {
    tier: 'pro',
    name: 'Profissional',
    monthlyPrice: 179,
    studentLimit: 150,
    benefits: ['Tudo do Essencial', 'Faixas e graduações', 'Ranking e ofensivas', 'Professores ilimitados'],
    popular: true,
  },
  {
    tier: 'elite',
    name: 'Elite',
    monthlyPrice: 299,
    studentLimit: null,
    benefits: ['Tudo do Profissional', 'Alunos ilimitados', 'Área do competidor', 'Suporte prioritário'],
  },
];

export const DEFAULT_PLAN: PlanTier = PLANS.find((p) => p.popular)?.tier ?? PLANS[0]!.tier;

/** Price per month for the period (annual = discounted monthly equivalent), rounded to cents. */
export function monthlyPriceFor(plan: Plan, period: BillingPeriod): number {
  const price = period === 'annual' ? plan.monthlyPrice * (1 - ANNUAL_DISCOUNT) : plan.monthlyPrice;
  return Math.round(price * 100) / 100;
}

/** 179 → "R$ 179"; 143.2 → "R$ 143,20". */
export function formatBrl(value: number): string {
  const cents = Math.round(value * 100) % 100 !== 0;
  return `R$ ${value.toLocaleString('pt-BR', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/** "Até 150 alunos" / "Alunos ilimitados". */
export function studentLimitLabel(plan: Plan): string {
  return plan.studentLimit === null ? 'Alunos ilimitados' : `Até ${plan.studentLimit} alunos`;
}

/** "-20%" for the annual toggle. */
export function annualDiscountLabel(): string {
  return `-${Math.round(ANNUAL_DISCOUNT * 100)}%`;
}
