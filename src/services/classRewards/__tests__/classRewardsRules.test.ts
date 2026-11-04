import type { Checkin } from '@domain/Classes/classesTypes';

import { detectReward, lastConfirmedReviewAt, parseSnapshot, type RewardsCurrent } from '../classRewardsRules';

const checkin = (id: string, status: Checkin['status'], reviewedAt: string | null): Checkin => ({
  id, userId: 'u', scheduleId: 's', classDate: '2026-11-04', status, reviewedAt,
});

const checkins = [
  checkin('a', 'confirmed', '2026-11-01T10:00:00Z'),
  checkin('b', 'confirmed', '2026-11-04T22:00:00Z'),
  checkin('c', 'rejected', '2026-11-05T10:00:00Z'),
  checkin('d', 'pending', null),
];

const current = (over: Partial<RewardsCurrent> = {}): RewardsCurrent => ({
  confirmedTotal: 2,
  beltAwardedAt: null,
  lastReviewedAt: lastConfirmedReviewAt(checkins),
  belt: null,
  ...over,
});

describe('detectReward', () => {
  it('saves silently on the first run', () => {
    const { reward, snapshot } = detectReward(null, current(), checkins);
    expect(reward).toBeNull();
    expect(snapshot.lastReviewedAt).toBe('2026-11-04T22:00:00Z');
  });

  it('rewards confirmed check-ins decided after the snapshot, ignoring rejected', () => {
    const prev = { confirmedTotal: 1, beltAwardedAt: null, lastReviewedAt: '2026-11-02T00:00:00Z' };
    expect(detectReward(prev, current(), checkins).reward).toEqual({ kind: 'checkinConfirmed', count: 1 });
  });

  it('prefers a class milestone over a plain check-in', () => {
    const prev = { confirmedTotal: 9, beltAwardedAt: null, lastReviewedAt: '2026-11-02T00:00:00Z' };
    expect(detectReward(prev, current({ confirmedTotal: 10 }), checkins).reward).toEqual({ kind: 'milestone', value: 10 });
  });

  it('prefers a new belt over everything', () => {
    const prev = { confirmedTotal: 9, beltAwardedAt: '2026-10-01T00:00:00Z', lastReviewedAt: null };
    const now = current({ confirmedTotal: 10, belt: 'blue', beltAwardedAt: '2026-11-04T23:00:00Z' });
    expect(detectReward(prev, now, checkins).reward).toEqual({ kind: 'belt', belt: 'blue' });
  });

  it('gives nothing when nothing changed', () => {
    const { snapshot } = detectReward(null, current(), checkins);
    expect(detectReward(snapshot, current(), checkins).reward).toBeNull();
  });
});

describe('parseSnapshot', () => {
  it('rejects missing or malformed data', () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot('not json')).toBeNull();
    expect(parseSnapshot('{"foo":1}')).toBeNull();
    expect(parseSnapshot('{"confirmedTotal":3}')).toEqual({ confirmedTotal: 3, beltAwardedAt: null, lastReviewedAt: null });
  });
});
