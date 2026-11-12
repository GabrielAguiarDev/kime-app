import {
  expiryLabel,
  homeAnnouncement,
  isExpired,
  isValidAnnouncementBody,
  publishedLabel,
  splitAnnouncements,
} from '../announcementsRules';
import type { Announcement } from '../announcementsTypes';

const TZ = 'America/Sao_Paulo';
const TODAY = '2026-11-12';

const a = (id: string, over: Partial<Announcement> = {}): Announcement => ({
  id,
  academyId: 'g',
  body: 'Sem aula na sexta.',
  modalityId: null,
  pinned: false,
  expiresOn: null,
  createdBy: 'u',
  // 12:00 in São Paulo.
  createdAt: '2026-11-12T15:00:00Z',
  updatedAt: '2026-11-12T15:00:00Z',
  authorName: 'Ana',
  authorAvatarPath: null,
  ...over,
});

describe('isExpired / splitAnnouncements', () => {
  it('keeps the last day itself', () => {
    expect(isExpired(a('x', { expiresOn: TODAY }), TODAY)).toBe(false);
    expect(isExpired(a('x', { expiresOn: '2026-11-11' }), TODAY)).toBe(true);
    expect(isExpired(a('x'), TODAY)).toBe(false);
  });
  it('splits keeping the order', () => {
    const list = [a('1'), a('2', { expiresOn: '2026-11-01' }), a('3')];
    const { current, expired } = splitAnnouncements(list, TODAY);
    expect(current.map((x) => x.id)).toEqual(['1', '3']);
    expect(expired.map((x) => x.id)).toEqual(['2']);
  });
});

describe('homeAnnouncement', () => {
  it('shows a pinned notice whatever its age', () => {
    const old = a('old', { pinned: true, createdAt: '2026-01-01T15:00:00Z' });
    expect(homeAnnouncement([old], TODAY, TZ)?.id).toBe('old');
  });
  it('shows an unpinned notice only in its first 7 days', () => {
    expect(homeAnnouncement([a('six', { createdAt: '2026-11-06T15:00:00Z' })], TODAY, TZ)?.id).toBe('six');
    expect(homeAnnouncement([a('seven', { createdAt: '2026-11-05T15:00:00Z' })], TODAY, TZ)).toBeNull();
  });
  it('never shows an expired one and takes the first in feed order', () => {
    const list = [a('gone', { pinned: true, expiresOn: '2026-11-10' }), a('new'), a('newer')];
    expect(homeAnnouncement(list, TODAY, TZ)?.id).toBe('new');
  });
  it('uses the academy day, not UTC', () => {
    // 01:00 UTC on the 6th is still the 5th in São Paulo: 7 days old.
    expect(homeAnnouncement([a('x', { createdAt: '2026-11-06T01:00:00Z' })], TODAY, TZ)).toBeNull();
  });
});

describe('labels', () => {
  it('publishedLabel', () => {
    expect(publishedLabel('2026-11-12T15:00:00Z', TODAY, TZ)).toBe('Hoje');
    expect(publishedLabel('2026-11-11T15:00:00Z', TODAY, TZ)).toBe('Ontem');
    expect(publishedLabel('2026-11-09T15:00:00Z', TODAY, TZ)).toBe('Há 3 dias');
    expect(publishedLabel('2026-10-01T15:00:00Z', TODAY, TZ)).toMatch(/^1 .* 2026$/);
  });
  it('expiryLabel', () => {
    expect(expiryLabel(a('x'), TODAY)).toBeNull();
    expect(expiryLabel(a('x', { expiresOn: '2026-11-20' }), TODAY)).toMatch(/^Até 20 /);
    expect(expiryLabel(a('x', { expiresOn: '2026-11-01' }), TODAY)).toMatch(/^Encerrado em 1 /);
  });
  it('isValidAnnouncementBody trims', () => {
    expect(isValidAnnouncementBody(' a ')).toBe(false);
    expect(isValidAnnouncementBody('ok')).toBe(true);
    expect(isValidAnnouncementBody('x'.repeat(1001))).toBe(false);
  });
});
