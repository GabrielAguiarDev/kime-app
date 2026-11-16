import type { PlanRowApi } from './plansApi';
import type { Plan } from './plans';

/** Cents → reais, percent → fraction. */
function toPlan(row: PlanRowApi): Plan {
  return {
    code: row.code,
    name: row.name,
    monthlyPrice: row.monthly_price_cents / 100,
    annualDiscount: row.annual_discount_pct / 100,
    studentLimit: row.student_limit ?? null,
    benefits: row.benefits ?? [],
    trialDays: row.trial_days,
    popular: row.is_popular,
  };
}

export const plansAdapter = { toPlan };
