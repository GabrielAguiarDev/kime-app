import { supabase } from '@infra/supabase';
import type { Database } from '@infra/supabase';

type Enums = Database['public']['Enums'];

const CHARGE_COLUMNS =
  'id, user_id, student_name, reference_month, due_date, amount_cents, paid_on, payment_method, paid_amount_cents';
const EXPENSE_COLUMNS = 'id, description, category, amount_cents, expense_date, repeats_monthly';

/** Null when the academy never opened the finance settings (= off). */
async function getSettings(academyId: string) {
  const { data, error } = await supabase
    .from('academy_finance_settings')
    .select('academy_id, enabled, default_due_day, block_overdue')
    .eq('academy_id', academyId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function saveSettings(
  academyId: string,
  values: Partial<{ enabled: boolean; default_due_day: number; block_overdue: boolean }>,
) {
  // Update, then insert when there is no row yet: an upsert would need UPDATE on academy_id.
  const updated = await supabase.from('academy_finance_settings').update(values).eq('academy_id', academyId).select('academy_id');
  if (updated.error) throw updated.error;
  if (updated.data.length > 0) return;
  const { error } = await supabase.from('academy_finance_settings').insert({ academy_id: academyId, ...values });
  if (error) throw error;
}

async function listPlans(academyId: string) {
  const { data, error } = await supabase
    .from('finance_plans')
    .select('id, name, amount_cents, archived_at')
    .eq('academy_id', academyId)
    .order('amount_cents')
    .order('name');
  if (error) throw error;
  return data;
}

async function createPlan(academyId: string, name: string, amountCents: number) {
  const { error } = await supabase.from('finance_plans').insert({ academy_id: academyId, name, amount_cents: amountCents });
  if (error) throw error;
}

async function updatePlan(id: string, values: Partial<{ name: string; amount_cents: number; archived_at: string | null }>) {
  const { data, error } = await supabase.from('finance_plans').update(values).eq('id', id).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

async function getBilling(membershipId: string) {
  const { data, error } = await supabase
    .from('finance_student_billing')
    .select('membership_id, plan_id, custom_amount_cents, due_day, is_exempt')
    .eq('membership_id', membershipId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function saveBilling(
  academyId: string,
  membershipId: string,
  values: { plan_id: string | null; custom_amount_cents: number | null; due_day: number | null; is_exempt: boolean },
) {
  // Update, then insert when there is no row yet (see saveSettings).
  const updated = await supabase.from('finance_student_billing').update(values).eq('membership_id', membershipId).select('membership_id');
  if (updated.error) throw updated.error;
  if (updated.data.length > 0) return;
  const { error } = await supabase
    .from('finance_student_billing')
    .insert({ academy_id: academyId, membership_id: membershipId, ...values });
  if (error) throw error;
}

/** History of one student (also after leaving: by user, not membership). */
async function listStudentCharges(academyId: string, userId: string) {
  const { data, error } = await supabase
    .from('finance_charges')
    .select(CHARGE_COLUMNS)
    .eq('academy_id', academyId)
    .eq('user_id', userId)
    .order('reference_month', { ascending: false });
  if (error) throw error;
  return data;
}

async function listMonthCharges(academyId: string, month: string) {
  const { data, error } = await supabase
    .from('finance_charges')
    .select(CHARGE_COLUMNS)
    .eq('academy_id', academyId)
    .eq('reference_month', month)
    .order('student_name');
  if (error) throw error;
  return data;
}

async function listOpenCharges(academyId: string) {
  const { data, error } = await supabase.rpc('finance_open_charges', { p_academy_id: academyId });
  if (error) throw error;
  return data;
}

async function setPayment(
  chargeId: string,
  values: { paid_on: string | null; payment_method: Enums['finance_payment_method'] | null; paid_amount_cents: number | null },
) {
  const { data, error } = await supabase.from('finance_charges').update(values).eq('id', chargeId).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

async function listExpenses(academyId: string, from: string, to: string) {
  const { data, error } = await supabase
    .from('finance_expenses')
    .select(EXPENSE_COLUMNS)
    .eq('academy_id', academyId)
    .gte('expense_date', from)
    .lt('expense_date', to)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

type ExpenseValues = {
  description: string;
  category: Enums['finance_expense_category'];
  amount_cents: number;
  expense_date: string;
  repeats_monthly: boolean;
};

async function createExpense(academyId: string, values: ExpenseValues) {
  const { error } = await supabase.from('finance_expenses').insert({ academy_id: academyId, ...values });
  if (error) throw error;
}

async function updateExpense(id: string, values: ExpenseValues) {
  const { data, error } = await supabase.from('finance_expenses').update(values).eq('id', id).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

async function deleteExpense(id: string) {
  const { error } = await supabase.from('finance_expenses').delete().eq('id', id);
  if (error) throw error;
}

async function report(academyId: string, month: string) {
  const { data, error } = await supabase.rpc('finance_report', { p_academy_id: academyId, p_month: month });
  if (error) throw error;
  return data;
}

async function myStatus(academyId: string) {
  const { data, error } = await supabase.rpc('my_finance_status', { p_academy_id: academyId });
  if (error) throw error;
  return data[0] ?? null;
}

export type ChargeRowApi = Awaited<ReturnType<typeof listStudentCharges>>[number];
export type OpenChargeRowApi = Awaited<ReturnType<typeof listOpenCharges>>[number];
export type ExpenseRowApi = Awaited<ReturnType<typeof listExpenses>>[number];

export const financeApi = {
  getSettings,
  saveSettings,
  listPlans,
  createPlan,
  updatePlan,
  getBilling,
  saveBilling,
  listStudentCharges,
  listMonthCharges,
  listOpenCharges,
  setPayment,
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  report,
  myStatus,
};
