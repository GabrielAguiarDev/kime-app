import type { LocalDate } from '@domain/Classes';
import { formatPrice } from '@domain/Events/eventsRules';

import type { Charge, ChargeStatus, ExpenseCategory, Expense, OpenCharge, PaymentMethod } from './financeTypes';

export const PLAN_NAME_MAX = 60;
export const EXPENSE_DESCRIPTION_MAX = 120;
export const CHARGE_MAX_CENTS = 10_000_000;
export const EXPENSE_MAX_CENTS = 100_000_000;
/** Due days stop at 28 so every month has one. */
export const DUE_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'pix', label: 'Pix' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'card', label: 'Cartão' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'other', label: 'Outra' },
];

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'rent', label: 'Aluguel' },
  { value: 'water', label: 'Água' },
  { value: 'energy', label: 'Energia' },
  { value: 'internet', label: 'Internet' },
  { value: 'equipment', label: 'Equipamentos' },
  { value: 'salaries', label: 'Salários' },
  { value: 'maintenance', label: 'Manutenção' },
  { value: 'taxes', label: 'Impostos' },
  { value: 'other', label: 'Outros' },
];

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export { formatPrice as formatMoney };

export function categoryLabel(category: ExpenseCategory): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === category)?.label ?? 'Outros';
}

export function methodLabel(method: PaymentMethod | null): string | null {
  return method ? (PAYMENT_METHODS.find((m) => m.value === method)?.label ?? null) : null;
}

/** Pending until the due date (inclusive), overdue after it, paid when marked. */
export function chargeStatus(charge: Pick<Charge, 'paidOn' | 'dueDate'>, today: LocalDate): ChargeStatus {
  if (charge.paidOn) return 'paid';
  return today > charge.dueDate ? 'overdue' : 'pending';
}

export function statusLabel(status: ChargeStatus): string {
  return status === 'paid' ? 'Paga' : status === 'overdue' ? 'Atrasada' : 'Pendente';
}

// ------------------------------------------------------------------ months ---
/** First day of the date's month. */
export function monthOf(date: LocalDate): LocalDate {
  return `${date.slice(0, 7)}-01`;
}

export function addMonths(month: LocalDate, n: number): LocalDate {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const index = y * 12 + (m - 1) + n;
  const year = Math.floor(index / 12);
  const mm = String((index % 12) + 1).padStart(2, '0');
  return `${year}-${mm}-01`;
}

/** [first day, first day of the next month) */
export function monthRange(month: LocalDate): { from: LocalDate; to: LocalDate } {
  return { from: monthOf(month), to: addMonths(monthOf(month), 1) };
}

/** "novembro" */
export function monthName(month: LocalDate): string {
  return MONTHS[Number(month.slice(5, 7)) - 1] ?? '';
}

/** "Novembro de 2026" */
export function monthTitle(month: LocalDate): string {
  const name = monthName(month);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${month.slice(0, 4)}`;
}

/** "nov" */
export function monthShort(month: LocalDate): string {
  return monthName(month).slice(0, 3);
}

/** "nov/26" when the reference year differs from today's, "novembro" otherwise. */
export function referenceLabel(month: LocalDate, today: LocalDate): string {
  return month.slice(0, 4) === today.slice(0, 4) ? monthName(month) : `${monthShort(month)}/${month.slice(2, 4)}`;
}

/** Due date of a month for a due day (1–28). */
export function dueDateOf(month: LocalDate, dueDay: number): LocalDate {
  return `${month.slice(0, 7)}-${String(dueDay).padStart(2, '0')}`;
}

// ------------------------------------------------------------------- money ---
/**
 * Money typed in a form ("150", "150,5", "1.250,00"). Required: empty is
 * invalid. Zero allowed only with `allowZero` (amount received with a full discount).
 */
export function parseMoney(
  text: string,
  { max = CHARGE_MAX_CENTS, allowZero = false }: { max?: number; allowZero?: boolean } = {},
): number | null {
  const match = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  const cents = Number(match[1]!.replace(/\./g, '')) * 100 + Number((match[2] ?? '0').padEnd(2, '0'));
  if (cents > max || cents < 0 || (cents === 0 && !allowZero)) return null;
  return cents;
}

/** Cents → form text ("150,00"). */
export function moneyToText(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? '' : formatPrice(cents).replace('R$ ', '');
}

// ------------------------------------------------------- open charges card ---
/** Total to receive; students counted once: overdue if any charge is overdue, pending otherwise. */
export function openChargesSummary(charges: OpenCharge[]): {
  totalCents: number;
  pendingStudents: number;
  overdueStudents: number;
} {
  const byStudent = new Map<string, boolean>();
  let totalCents = 0;
  for (const c of charges) {
    totalCents += c.amountCents;
    const key = c.userId ?? `charge:${c.id}`;
    byStudent.set(key, (byStudent.get(key) ?? false) || c.overdue);
  }
  let overdueStudents = 0;
  byStudent.forEach((overdue) => {
    if (overdue) overdueStudents += 1;
  });
  return { totalCents, pendingStudents: byStudent.size - overdueStudents, overdueStudents };
}

/** "Sua mensalidade de novembro está em aberto. Fale com a academia." */
export function overdueNotice(months: LocalDate[]): string | null {
  if (months.length === 0) return null;
  const names = months.map(monthName);
  if (names.length === 1) return `Sua mensalidade de ${names[0]} está em aberto. Fale com a academia.`;
  const list = `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
  return `Suas mensalidades de ${list} estão em aberto. Fale com a academia.`;
}

// --------------------------------------------------------------------- csv ---
function csvCell(value: string): string {
  return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Decimal comma, no thousands separator: opens as a number in spreadsheets set to pt-BR. */
function csvMoney(cents: number | null): string {
  if (cents === null) return '';
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`;
}

function brDate(date: LocalDate | null): string {
  if (!date) return '';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

/** Charges and expenses of one month, `;`-separated (pt-BR spreadsheets), with BOM for the accents. */
export function monthCsv(charges: Charge[], expenses: Expense[], today: LocalDate): string {
  const header = ['Tipo', 'Descrição', 'Categoria', 'Data', 'Valor', 'Status', 'Pago em', 'Forma', 'Valor recebido'];
  const rows: string[][] = [
    ...charges.map((c) => [
      'Mensalidade',
      c.studentName,
      monthName(c.referenceMonth),
      brDate(c.dueDate),
      csvMoney(c.amountCents),
      statusLabel(chargeStatus(c, today)),
      brDate(c.paidOn),
      methodLabel(c.paymentMethod) ?? '',
      csvMoney(c.paidAmountCents),
    ]),
    ...expenses.map((e) => [
      'Despesa',
      e.description,
      categoryLabel(e.category),
      brDate(e.expenseDate),
      csvMoney(e.amountCents),
      '',
      '',
      '',
      '',
    ]),
  ];
  return `﻿${[header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n')}\r\n`;
}
