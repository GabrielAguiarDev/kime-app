import type { LocalDate } from '@domain/Classes';

/** Management only: the app never processes payments. Owner only. */
export type PaymentMethod = 'pix' | 'cash' | 'card' | 'transfer' | 'other';

export type ExpenseCategory =
  | 'rent'
  | 'water'
  | 'energy'
  | 'internet'
  | 'equipment'
  | 'salaries'
  | 'maintenance'
  | 'taxes'
  | 'other';

/** Computed, never stored: pending until the due date, overdue after it, paid when marked. */
export type ChargeStatus = 'pending' | 'overdue' | 'paid';

export interface FinanceSettings {
  academyId: string;
  /** Off: nothing of the finance shows up for anyone. */
  enabled: boolean;
  /** 1–28. */
  defaultDueDay: number;
  /** Students more than 7 days late lose the academy features (enforced by the database). */
  blockOverdue: boolean;
}

export interface FinancePlan {
  id: string;
  name: string;
  amountCents: number;
  archivedAt: string | null;
}

/** Monthly fee of one student (membership). */
export interface StudentBilling {
  membershipId: string;
  planId: string | null;
  customAmountCents: number | null;
  /** Null = the academy default. */
  dueDay: number | null;
  isExempt: boolean;
}

export interface Charge {
  id: string;
  userId: string | null;
  studentName: string;
  /** First day of the month. */
  referenceMonth: LocalDate;
  dueDate: LocalDate;
  amountCents: number;
  paidOn: LocalDate | null;
  paymentMethod: PaymentMethod | null;
  paidAmountCents: number | null;
}

/** Unpaid charge of the current month or earlier (Início card and list). */
export interface OpenCharge {
  id: string;
  userId: string | null;
  /** Null when the student left the academy. */
  membershipId: string | null;
  fullName: string;
  avatarPath: string | null;
  referenceMonth: LocalDate;
  dueDate: LocalDate;
  amountCents: number;
  overdue: boolean;
}

export interface Expense {
  id: string;
  description: string;
  category: ExpenseCategory;
  amountCents: number;
  expenseDate: LocalDate;
  repeatsMonthly: boolean;
}

export interface ExpenseInput {
  description: string;
  category: ExpenseCategory;
  amountCents: number;
  expenseDate: LocalDate;
  repeatsMonthly: boolean;
}

export interface PaymentInput {
  paidOn: LocalDate;
  method: PaymentMethod | null;
  paidAmountCents: number;
}

export interface LateStudent {
  userId: string;
  membershipId: string | null;
  fullName: string;
  avatarPath: string | null;
  months: number;
  amountCents: number;
}

/** One month, by reference month of the charges. */
export interface FinanceReport {
  receivedCents: number;
  receivableCents: number;
  overdueCents: number;
  expensesCents: number;
  /** Received minus expenses. */
  resultCents: number;
  chargesCount: number;
  overdueCount: number;
  /** The 6 months up to the selected one, oldest first. */
  history: { month: LocalDate; receivedCents: number; expensesCents: number }[];
  categories: { category: ExpenseCategory; amountCents: number }[];
  /** More than one month overdue today. */
  lateStudents: LateStudent[];
}

/** The student's own status: overdue months only, never amounts. */
export interface MyFinanceStatus {
  overdueMonths: LocalDate[];
  blocked: boolean;
}
