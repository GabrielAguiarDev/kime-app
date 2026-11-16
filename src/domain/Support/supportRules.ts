import { daysBetween, formatLocalDate } from '@domain/Competition/competitionRules';
import { localDate } from '@domain/Water/waterRules';

import type { SupportTicket, SupportTicketStatus } from './supportTypes';

/** Same limits as create_support_ticket / reply_support_ticket. */
export const SUPPORT_SUBJECT_MIN = 3;
export const SUPPORT_SUBJECT_MAX = 120;
export const SUPPORT_MESSAGE_MAX = 4000;

const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: 'Aguardando suporte',
  answered: 'Respondido',
  closed: 'Encerrado',
};

export function supportStatusLabel(status: SupportTicketStatus): string {
  return STATUS_LABELS[status];
}

/** Unknown values from the database are treated as open (waiting for Kimi). */
export function toSupportStatus(value: string): SupportTicketStatus {
  return value === 'answered' || value === 'closed' ? value : 'open';
}

export function isValidSupportSubject(subject: string): boolean {
  const length = subject.trim().length;
  return length >= SUPPORT_SUBJECT_MIN && length <= SUPPORT_SUBJECT_MAX;
}

export function isValidSupportMessage(body: string): boolean {
  const length = body.trim().length;
  return length >= 1 && length <= SUPPORT_MESSAGE_MAX;
}

/** Splits into active (open/answered; list order kept) and closed. */
export function splitTickets(list: SupportTicket[]): { active: SupportTicket[]; closed: SupportTicket[] } {
  return {
    active: list.filter((t) => t.status !== 'closed'),
    closed: list.filter((t) => t.status === 'closed'),
  };
}

const timeFormatters = new Map<string, Intl.DateTimeFormat>();

function timeOf(at: string, timeZone: string): string {
  let f = timeFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    timeFormatters.set(timeZone, f);
  }
  return f.format(new Date(at));
}

/** "Hoje, 14:32", "Ontem, 09:05", then "15 nov 2026, 14:32". */
export function supportTimeLabel(at: string, timeZone: string, now: Date = new Date()): string {
  const day = localDate(at, timeZone);
  const days = daysBetween(day, localDate(now, timeZone));
  const time = timeOf(at, timeZone);
  if (days <= 0) return `Hoje, ${time}`;
  if (days === 1) return `Ontem, ${time}`;
  return `${formatLocalDate(day)}, ${time}`;
}
