/**
 * Academy plans shown in the sign-up (step 1). The catalog lives in the
 * database (platform_plans, edited in the admin) and comes from
 * `list_public_plans()` (only active plans, in display order): see
 * plansApi / plansAdapter / usePublicPlans. There is no billing yet
 * ("Cobrança ainda não ativa nesta versão").
 *
 * `code` is what gets saved on the academy (academies.plan_tier, a foreign
 * key to platform_plans.code); the sign-up RPC accepts any ACTIVE plan code.
 */
export type BillingPeriod = 'monthly' | 'annual';

export interface Plan {
  code: string;
  name: string;
  /** Monthly price in BRL (reais) when billed monthly. */
  monthlyPrice: number;
  /** Annual billing: this share off the monthly price (0.2 = 20%). */
  annualDiscount: number;
  /** Null = unlimited. */
  studentLimit: number | null;
  benefits: string[];
  /** Free trial before the first charge (when billing exists). */
  trialDays: number;
  /** "Mais escolhido" badge. */
  popular: boolean;
}

/** The plan selected when the sign-up opens: the popular one, else the first; null without plans. */
export function defaultPlanCode(plans: Plan[]): string | null {
  return plans.find((p) => p.popular)?.code ?? plans[0]?.code ?? null;
}

/** Price per month for the period (annual = discounted monthly equivalent), rounded to cents. */
export function monthlyPriceFor(plan: Plan, period: BillingPeriod): number {
  const price = period === 'annual' ? plan.monthlyPrice * (1 - plan.annualDiscount) : plan.monthlyPrice;
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

/** "-20%" for the annual toggle; null when the plan has no annual discount. */
export function annualDiscountLabel(plan: Plan): string | null {
  const pct = Math.round(plan.annualDiscount * 100);
  return pct > 0 ? `-${pct}%` : null;
}
