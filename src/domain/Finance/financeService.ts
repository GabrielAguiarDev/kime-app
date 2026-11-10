import type { Json } from '@infra/supabase';
import { toAppError } from '@infra/supabase';

import { financeApi as api, type ChargeRowApi, type ExpenseRowApi, type OpenChargeRowApi } from './financeApi';
import { monthRange } from './financeRules';
import type {
  Charge,
  Expense,
  ExpenseCategory,
  ExpenseInput,
  FinancePlan,
  FinanceReport,
  FinanceSettings,
  MyFinanceStatus,
  OpenCharge,
  PaymentInput,
  StudentBilling,
} from './financeTypes';

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    throw toAppError(e);
  }
}

const DEFAULT_DUE_DAY = 10;

function toCharge(row: ChargeRowApi): Charge {
  return {
    id: row.id,
    userId: row.user_id,
    studentName: row.student_name,
    referenceMonth: row.reference_month,
    dueDate: row.due_date,
    amountCents: row.amount_cents,
    paidOn: row.paid_on,
    paymentMethod: row.payment_method,
    paidAmountCents: row.paid_amount_cents,
  };
}

function toOpenCharge(row: OpenChargeRowApi): OpenCharge {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    membershipId: row.membership_id ?? null,
    fullName: row.full_name,
    avatarPath: row.avatar_path ?? null,
    referenceMonth: row.reference_month,
    dueDate: row.due_date,
    amountCents: row.amount_cents,
    overdue: row.overdue,
  };
}

function toExpense(row: ExpenseRowApi): Expense {
  return {
    id: row.id,
    description: row.description,
    category: row.category,
    amountCents: row.amount_cents,
    expenseDate: row.expense_date,
    repeatsMonthly: row.repeats_monthly,
  };
}

const num = (value: unknown): number => (typeof value === 'number' ? value : Number(value ?? 0));

function toReport(data: Json): FinanceReport {
  const r = (data ?? {}) as Record<string, unknown>;
  const list = (key: string) => (Array.isArray(r[key]) ? (r[key] as Record<string, unknown>[]) : []);
  const received = num(r.received);
  const expenses = num(r.expenses);
  return {
    receivedCents: received,
    receivableCents: num(r.receivable),
    overdueCents: num(r.overdue),
    expensesCents: expenses,
    resultCents: received - expenses,
    chargesCount: num(r.charges_count),
    overdueCount: num(r.overdue_count),
    history: list('history').map((h) => ({
      month: String(h.month),
      receivedCents: num(h.received),
      expensesCents: num(h.expenses),
    })),
    categories: list('categories').map((c) => ({
      category: c.category as ExpenseCategory,
      amountCents: num(c.amount),
    })),
    lateStudents: list('late_students').map((s) => ({
      userId: String(s.user_id),
      membershipId: (s.membership_id as string | null) ?? null,
      fullName: String(s.full_name ?? 'Aluno'),
      avatarPath: (s.avatar_path as string | null) ?? null,
      months: num(s.months),
      amountCents: num(s.amount),
    })),
  };
}

const expenseValues = (input: ExpenseInput) => ({
  description: input.description.trim(),
  category: input.category,
  amount_cents: input.amountCents,
  expense_date: input.expenseDate,
  repeats_monthly: input.repeatsMonthly,
});

export const financeService = {
  /** Off by default (no row yet). */
  getSettings: (academyId: string): Promise<FinanceSettings> =>
    call(async () => {
      const row = await api.getSettings(academyId);
      return {
        academyId,
        enabled: row?.enabled ?? false,
        defaultDueDay: row?.default_due_day ?? DEFAULT_DUE_DAY,
        blockOverdue: row?.block_overdue ?? false,
      };
    }),
  saveSettings: (academyId: string, values: Partial<Omit<FinanceSettings, 'academyId'>>) =>
    call(() =>
      api.saveSettings(academyId, {
        ...(values.enabled !== undefined ? { enabled: values.enabled } : {}),
        ...(values.defaultDueDay !== undefined ? { default_due_day: values.defaultDueDay } : {}),
        ...(values.blockOverdue !== undefined ? { block_overdue: values.blockOverdue } : {}),
      }),
    ),
  listPlans: (academyId: string): Promise<FinancePlan[]> =>
    call(async () =>
      (await api.listPlans(academyId)).map((p) => ({
        id: p.id,
        name: p.name,
        amountCents: p.amount_cents,
        archivedAt: p.archived_at,
      })),
    ),
  createPlan: (academyId: string, name: string, amountCents: number) =>
    call(() => api.createPlan(academyId, name.trim(), amountCents)),
  updatePlan: (id: string, name: string, amountCents: number) =>
    call(() => api.updatePlan(id, { name: name.trim(), amount_cents: amountCents })),
  setPlanArchived: (id: string, archived: boolean) =>
    call(() => api.updatePlan(id, { archived_at: archived ? new Date().toISOString() : null })),
  getBilling: (membershipId: string): Promise<StudentBilling | null> =>
    call(async () => {
      const row = await api.getBilling(membershipId);
      return row
        ? {
            membershipId: row.membership_id,
            planId: row.plan_id,
            customAmountCents: row.custom_amount_cents,
            dueDay: row.due_day,
            isExempt: row.is_exempt,
          }
        : null;
    }),
  saveBilling: (academyId: string, billing: StudentBilling) =>
    call(() =>
      api.saveBilling(academyId, billing.membershipId, {
        plan_id: billing.planId,
        custom_amount_cents: billing.customAmountCents,
        due_day: billing.dueDay,
        is_exempt: billing.isExempt,
      }),
    ),
  listStudentCharges: (academyId: string, userId: string): Promise<Charge[]> =>
    call(async () => (await api.listStudentCharges(academyId, userId)).map(toCharge)),
  listMonthCharges: (academyId: string, month: string): Promise<Charge[]> =>
    call(async () => (await api.listMonthCharges(academyId, month)).map(toCharge)),
  listOpenCharges: (academyId: string): Promise<OpenCharge[]> =>
    call(async () => (await api.listOpenCharges(academyId)).map(toOpenCharge)),
  markPaid: (chargeId: string, input: PaymentInput) =>
    call(() =>
      api.setPayment(chargeId, {
        paid_on: input.paidOn,
        payment_method: input.method,
        paid_amount_cents: input.paidAmountCents,
      }),
    ),
  undoPayment: (chargeId: string) =>
    call(() => api.setPayment(chargeId, { paid_on: null, payment_method: null, paid_amount_cents: null })),
  listExpenses: (academyId: string, month: string): Promise<Expense[]> =>
    call(async () => {
      const { from, to } = monthRange(month);
      return (await api.listExpenses(academyId, from, to)).map(toExpense);
    }),
  createExpense: (academyId: string, input: ExpenseInput) => call(() => api.createExpense(academyId, expenseValues(input))),
  updateExpense: (id: string, input: ExpenseInput) => call(() => api.updateExpense(id, expenseValues(input))),
  deleteExpense: (id: string) => call(() => api.deleteExpense(id)),
  report: (academyId: string, month: string): Promise<FinanceReport> =>
    call(async () => toReport(await api.report(academyId, month))),
  /** Students only; null when finance is off or the caller is not a student. */
  myStatus: (academyId: string): Promise<MyFinanceStatus | null> =>
    call(async () => {
      const row = await api.myStatus(academyId);
      return row ? { overdueMonths: row.overdue_months ?? [], blocked: row.blocked } : null;
    }),
};
