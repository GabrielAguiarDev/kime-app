import {
  eventCountdownLabel,
  eventNotices,
  eventRevenue,
  eventsOn,
  eventWhenLabel,
  formatPrice,
  goingLabel,
  groupPeople,
  isFullFor,
  maskTime,
  parseCapacity,
  parsePrice,
  parseTime,
  pastOrCancelledEvents,
  planEventReminders,
  priceLabel,
  priceToText,
  rsvpOpen,
  spotsLabel,
  spotsLeft,
  upcomingEvents,
} from '../eventsRules';
import type { AcademyEvent, EventPerson } from '../eventsTypes';

const event = (over: Partial<AcademyEvent> = {}): AcademyEvent => ({
  id: 'e1',
  academyId: 'a',
  title: 'Confraternização',
  description: null,
  eventDate: '2026-11-14',
  startTime: '19:00',
  endTime: null,
  location: null,
  allModalities: true,
  modalityIds: [],
  priceCents: null,
  capacity: null,
  rsvpDeadline: null,
  coverPath: null,
  createdBy: 'staff',
  cancelledAt: null,
  createdAt: '2026-11-01T12:00:00Z',
  ...over,
});

const person = (over: Partial<EventPerson>): EventPerson => ({
  userId: 'u',
  fullName: 'Ana',
  avatarPath: null,
  role: 'student',
  belt: null,
  status: null,
  respondedAt: null,
  attended: null,
  paid: null,
  ...over,
});

describe('price', () => {
  it('formats in reais', () => {
    expect(formatPrice(4000)).toBe('R$ 40,00');
    expect(formatPrice(125050)).toBe('R$ 1.250,50');
    expect(formatPrice(5)).toBe('R$ 0,05');
  });
  it('labels free and paid events', () => {
    expect(priceLabel(null)).toBe('Gratuito');
    expect(priceLabel(4000)).toBe('R$ 40,00 · pagamento direto com a academia');
  });
  it('parses what is typed (empty = free)', () => {
    expect(parsePrice('')).toEqual({ valid: true, cents: null });
    expect(parsePrice('40')).toEqual({ valid: true, cents: 4000 });
    expect(parsePrice('40,5')).toEqual({ valid: true, cents: 4050 });
    expect(parsePrice('1.250,00')).toEqual({ valid: true, cents: 125000 });
    expect(parsePrice('0').valid).toBe(false);
    expect(parsePrice('40,555').valid).toBe(false);
    expect(parsePrice('abc').valid).toBe(false);
  });
  it('round-trips to the form text', () => {
    expect(priceToText(4000)).toBe('40,00');
    expect(priceToText(null)).toBe('');
  });
});

describe('form fields', () => {
  it('masks and validates times', () => {
    expect(maskTime('1900')).toBe('19:00');
    expect(maskTime('7')).toBe('7');
    expect(parseTime('19:00')).toBe('19:00');
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('9:00')).toBeNull();
  });
  it('validates the capacity (empty = no limit)', () => {
    expect(parseCapacity('')).toEqual({ valid: true, capacity: null });
    expect(parseCapacity('30')).toEqual({ valid: true, capacity: 30 });
    expect(parseCapacity('0').valid).toBe(false);
  });
});

describe('labels', () => {
  it('says when', () => {
    expect(eventWhenLabel(event())).toBe('sáb, 14 nov · 19:00');
    expect(eventWhenLabel(event({ endTime: '23:00' }))).toBe('sáb, 14 nov · 19:00–23:00');
    expect(eventCountdownLabel('2026-11-14', '2026-11-14')).toBe('Hoje');
    expect(eventCountdownLabel('2026-11-13', '2026-11-14')).toBe('Amanhã');
    expect(eventCountdownLabel('2026-11-10', '2026-11-14')).toBe('Em 4 dias');
  });
  it('counts people and spots', () => {
    expect(goingLabel(1)).toBe('1 vai');
    expect(goingLabel(12)).toBe('12 vão');
    expect(spotsLabel(0)).toBe('Vagas esgotadas');
    expect(spotsLabel(1)).toBe('1 vaga restante');
  });
});

describe('lists', () => {
  const list = [
    event({ id: 'later', eventDate: '2026-11-20' }),
    event({ id: 'soon', eventDate: '2026-11-12', startTime: '20:00' }),
    event({ id: 'soon-early', eventDate: '2026-11-12', startTime: '08:00' }),
    event({ id: 'past', eventDate: '2026-11-01' }),
    event({ id: 'cancelled', eventDate: '2026-11-15', cancelledAt: '2026-11-09T10:00:00Z' }),
  ];
  it('upcoming: not cancelled, from today, nearest first', () => {
    expect(upcomingEvents(list, '2026-11-10').map((e) => e.id)).toEqual(['soon-early', 'soon', 'later']);
  });
  it('past or cancelled, newest first', () => {
    expect(pastOrCancelledEvents(list, '2026-11-10').map((e) => e.id)).toEqual(['cancelled', 'past']);
  });
  it('agenda of a day leaves cancelled events out', () => {
    expect(eventsOn(list, '2026-11-12').map((e) => e.id)).toEqual(['soon-early', 'soon']);
    expect(eventsOn(list, '2026-11-15')).toEqual([]);
  });
});

describe('answers', () => {
  it('is open until the deadline, or the event day', () => {
    expect(rsvpOpen(event(), '2026-11-14')).toBe(true);
    expect(rsvpOpen(event(), '2026-11-15')).toBe(false);
    expect(rsvpOpen(event({ rsvpDeadline: '2026-11-12' }), '2026-11-13')).toBe(false);
    expect(rsvpOpen(event({ cancelledAt: 'x' }), '2026-11-10')).toBe(false);
  });
  it('is full for newcomers, not for who already goes', () => {
    const e = event({ capacity: 2 });
    expect(spotsLeft(e, 3)).toBe(0);
    expect(spotsLeft(event(), 3)).toBeNull();
    expect(isFullFor(e, 2, null)).toBe(true);
    expect(isFullFor(e, 2, 'going')).toBe(false);
    expect(isFullFor(e, 1, 'not_going')).toBe(false);
  });
  it('groups the audience for staff', () => {
    const groups = groupPeople([
      person({ userId: 'b', fullName: 'Bia', status: 'going' }),
      person({ userId: 'a', fullName: 'Ana', status: 'going' }),
      person({ userId: 'c', fullName: 'Caio', status: 'not_going' }),
      person({ userId: 'd', fullName: 'Duda' }),
    ]);
    expect(groups.going.map((p) => p.fullName)).toEqual(['Ana', 'Bia']);
    expect(groups.notGoing).toHaveLength(1);
    expect(groups.noAnswer).toHaveLength(1);
  });
});

describe('planEventReminders', () => {
  it('reminds the day before at 18:00 (academy time) for events the person goes to', () => {
    const plan = planEventReminders({
      events: [event(), event({ id: 'e2', eventDate: '2026-11-20' }), event({ id: 'e3', cancelledAt: 'x' })],
      goingIds: new Set(['e1', 'e3']),
      timeZone: 'America/Sao_Paulo',
      now: new Date('2026-11-10T12:00:00Z'),
    });
    expect(plan).toHaveLength(1);
    // 13 nov 18:00 in São Paulo (UTC−3) = 21:00 UTC.
    expect(plan[0]!.at.toISOString()).toBe('2026-11-13T21:00:00.000Z');
    expect(plan[0]!.body).toBe('Confraternização às 19:00 · Na academia.');
  });
  it('skips reminders already past', () => {
    const plan = planEventReminders({
      events: [event()],
      goingIds: new Set(['e1']),
      timeZone: 'America/Sao_Paulo',
      now: new Date('2026-11-13T22:00:00Z'),
    });
    expect(plan).toEqual([]);
  });
});

describe('eventNotices', () => {
  const base = { userId: 'me', goingIds: new Set<string>(), today: '2026-11-10' };
  it('only records on the first run', () => {
    const { notices, next } = eventNotices({ ...base, events: [event()], previous: null });
    expect(notices).toEqual([]);
    expect(next.seen).toEqual(['e1']);
  });
  it('announces new upcoming events not created by the person', () => {
    const { notices } = eventNotices({
      ...base,
      events: [event(), event({ id: 'mine', createdBy: 'me' }), event({ id: 'old', eventDate: '2026-11-01' })],
      previous: { seen: [], cancelled: [] },
    });
    expect(notices.map((n) => n.eventId)).toEqual(['e1']);
    expect(notices[0]!.title).toBe('Novo evento: Confraternização');
  });
  it('warns whoever was going when an event is cancelled, once', () => {
    const cancelled = event({ cancelledAt: '2026-11-10T10:00:00Z' });
    const first = eventNotices({
      ...base,
      goingIds: new Set(['e1']),
      events: [cancelled],
      previous: { seen: ['e1'], cancelled: [] },
    });
    expect(first.notices.map((n) => n.title)).toEqual(['Evento cancelado']);
    const again = eventNotices({ ...base, goingIds: new Set(['e1']), events: [cancelled], previous: first.next });
    expect(again.notices).toEqual([]);
    const notGoing = eventNotices({ ...base, events: [cancelled], previous: { seen: ['e1'], cancelled: [] } });
    expect(notGoing.notices).toEqual([]);
  });
});

describe('eventRevenue', () => {
  it('adds up who paid and forecasts with who is going', () => {
    const r = eventRevenue(4000, [
      { status: 'going', paid: true },
      { status: 'going', paid: false },
      { status: 'going', paid: true },
      { status: 'not_going', paid: true },
      { status: null, paid: null },
    ]);
    expect(r).toEqual({ paidCount: 3, goingCount: 3, receivedCents: 12000, expectedCents: 12000 });
  });
});
