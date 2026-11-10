import {
  addMonths,
  chargeStatus,
  monthCsv,
  monthOf,
  monthRange,
  monthTitle,
  moneyToText,
  openChargesSummary,
  overdueNotice,
  parseMoney,
  referenceLabel,
} from '../financeRules';
import type { Charge, Expense, OpenCharge } from '../financeTypes';

const charge = (over: Partial<Charge> = {}): Charge => ({
  id: 'c1',
  userId: 'u1',
  studentName: 'Ana',
  referenceMonth: '2026-11-01',
  dueDate: '2026-11-10',
  amountCents: 15000,
  paidOn: null,
  paymentMethod: null,
  paidAmountCents: null,
  ...over,
});

const open = (over: Partial<OpenCharge> = {}): OpenCharge => ({
  id: 'c1',
  userId: 'u1',
  membershipId: 'm1',
  fullName: 'Ana',
  avatarPath: null,
  referenceMonth: '2026-11-01',
  dueDate: '2026-11-10',
  amountCents: 15000,
  overdue: false,
  ...over,
});

describe('chargeStatus', () => {
  it('is pending until the due date, overdue after it, paid when marked', () => {
    expect(chargeStatus(charge(), '2026-11-09')).toBe('pending');
    expect(chargeStatus(charge(), '2026-11-10')).toBe('pending');
    expect(chargeStatus(charge(), '2026-11-11')).toBe('overdue');
    expect(chargeStatus(charge({ paidOn: '2026-11-20' }), '2026-12-01')).toBe('paid');
  });
});

describe('months', () => {
  it('moves across years', () => {
    expect(addMonths('2026-11-01', 2)).toBe('2027-01-01');
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01');
    expect(addMonths('2026-06-01', -5)).toBe('2026-01-01');
  });
  it('first day and range', () => {
    expect(monthOf('2026-11-30')).toBe('2026-11-01');
    expect(monthRange('2026-12-15')).toEqual({ from: '2026-12-01', to: '2027-01-01' });
  });
  it('labels', () => {
    expect(monthTitle('2026-03-01')).toBe('Março de 2026');
    expect(referenceLabel('2026-10-01', '2026-11-10')).toBe('outubro');
    expect(referenceLabel('2025-12-01', '2026-01-10')).toBe('dez/25');
  });
});

describe('parseMoney', () => {
  it('reads reais and cents', () => {
    expect(parseMoney('150')).toBe(15000);
    expect(parseMoney('150,5')).toBe(15050);
    expect(parseMoney('1.250,00')).toBe(125000);
  });
  it('rejects empty, zero (unless allowed) and junk', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('0')).toBeNull();
    expect(parseMoney('0', { allowZero: true })).toBe(0);
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('100001,00')).toBeNull();
  });
  it('round-trips to text', () => {
    expect(moneyToText(125050)).toBe('1.250,50');
    expect(moneyToText(null)).toBe('');
  });
});

describe('openChargesSummary', () => {
  it('sums and counts students once (overdue wins)', () => {
    const summary = openChargesSummary([
      open({ id: 'a', userId: 'u1', overdue: true, amountCents: 10000 }),
      open({ id: 'b', userId: 'u1', overdue: false, amountCents: 10000 }),
      open({ id: 'c', userId: 'u2', overdue: false, amountCents: 5000 }),
    ]);
    expect(summary).toEqual({ totalCents: 25000, pendingStudents: 1, overdueStudents: 1 });
  });
  it('is zero when empty', () => {
    expect(openChargesSummary([])).toEqual({ totalCents: 0, pendingStudents: 0, overdueStudents: 0 });
  });
});

describe('overdueNotice', () => {
  it('names the months, never amounts', () => {
    expect(overdueNotice([])).toBeNull();
    expect(overdueNotice(['2026-11-01'])).toBe('Sua mensalidade de novembro está em aberto. Fale com a academia.');
    expect(overdueNotice(['2026-09-01', '2026-10-01', '2026-11-01'])).toBe(
      'Suas mensalidades de setembro, outubro e novembro estão em aberto. Fale com a academia.',
    );
  });
});

describe('monthCsv', () => {
  it('lists charges and expenses with ; and decimal comma', () => {
    const expense: Expense = {
      id: 'e1',
      description: 'Aluguel; salão',
      category: 'rent',
      amountCents: 120000,
      expenseDate: '2026-11-05',
      repeatsMonthly: true,
    };
    const csv = monthCsv(
      [charge({ paidOn: '2026-11-08', paymentMethod: 'pix', paidAmountCents: 14000 }), charge({ id: 'c2', studentName: 'Bia' })],
      [expense],
      '2026-11-20',
    );
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    expect(lines[0]).toBe('Tipo;Descrição;Categoria;Data;Valor;Status;Pago em;Forma;Valor recebido');
    expect(lines[1]).toBe('Mensalidade;Ana;novembro;10/11/2026;150,00;Paga;08/11/2026;Pix;140,00');
    expect(lines[2]).toBe('Mensalidade;Bia;novembro;10/11/2026;150,00;Atrasada;;;');
    expect(lines[3]).toBe('Despesa;"Aluguel; salão";Aluguel;05/11/2026;1200,00;;;;');
  });
});
