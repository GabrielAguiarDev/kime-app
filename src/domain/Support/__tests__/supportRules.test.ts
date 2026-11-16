import {
  isValidSupportMessage,
  isValidSupportSubject,
  splitTickets,
  supportStatusLabel,
  supportTimeLabel,
  toSupportStatus,
} from '../supportRules';
import type { SupportTicket } from '../supportTypes';

const TZ = 'America/Sao_Paulo';

const ticket = (id: string, status: SupportTicket['status']): SupportTicket => ({
  id,
  number: 1,
  academyId: null,
  subject: 'Assunto',
  status,
  lastMessageAt: '2026-11-16T12:00:00Z',
  closedAt: null,
  createdAt: '2026-11-16T12:00:00Z',
});

describe('support rules', () => {
  it('status labels in pt-BR; unknown values count as open', () => {
    expect(supportStatusLabel('open')).toBe('Aguardando suporte');
    expect(supportStatusLabel('answered')).toBe('Respondido');
    expect(supportStatusLabel('closed')).toBe('Encerrado');
    expect(toSupportStatus('answered')).toBe('answered');
    expect(toSupportStatus('weird')).toBe('open');
  });

  it('validates like the server (trimmed lengths)', () => {
    expect(isValidSupportSubject(' ab ')).toBe(false);
    expect(isValidSupportSubject('abc')).toBe(true);
    expect(isValidSupportSubject('x'.repeat(121))).toBe(false);
    expect(isValidSupportMessage('   ')).toBe(false);
    expect(isValidSupportMessage('a')).toBe(true);
    expect(isValidSupportMessage('x'.repeat(4001))).toBe(false);
  });

  it('splits active and closed, keeping the order', () => {
    const { active, closed } = splitTickets([ticket('a', 'answered'), ticket('b', 'closed'), ticket('c', 'open')]);
    expect(active.map((t) => t.id)).toEqual(['a', 'c']);
    expect(closed.map((t) => t.id)).toEqual(['b']);
  });

  it('time label in the academy calendar', () => {
    const now = new Date('2026-11-16T15:00:00Z'); // 12:00 in São Paulo
    expect(supportTimeLabel('2026-11-16T13:05:00Z', TZ, now)).toBe('Hoje, 10:05');
    // 01:30 UTC on the 16th is still the 15th in São Paulo.
    expect(supportTimeLabel('2026-11-16T01:30:00Z', TZ, now)).toBe('Ontem, 22:30');
    expect(supportTimeLabel('2026-11-10T20:00:00Z', TZ, now)).toBe('10 nov 2026, 17:00');
  });
});
