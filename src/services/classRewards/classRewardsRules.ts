import { milestoneCrossed } from '@domain/Classes/classesRules';
import type { BeltLook, Checkin } from '@domain/Classes/classesTypes';

/** What the student has already been rewarded for, per user + academy. */
export interface RewardsSnapshot {
  confirmedTotal: number;
  /** ISO timestamp of the last graduation seen (any modality). */
  beltAwardedAt: string | null;
  /** ISO timestamp of the newest confirmed check-in decision seen. */
  lastReviewedAt: string | null;
}

export interface RewardsCurrent extends RewardsSnapshot {
  /** The belt of that latest graduation. */
  belt: BeltLook | null;
}

/** One reward at a time, most important first. */
export type ClassReward =
  | { kind: 'belt'; belt: BeltLook }
  | { kind: 'milestone'; value: number }
  | { kind: 'checkinConfirmed'; count: number };

const time = (iso: string | null) => (iso ? Date.parse(iso) : Number.NEGATIVE_INFINITY);

/** Newest `reviewedAt` among confirmed check-ins (rejected ones are not rewards). */
export function lastConfirmedReviewAt(checkins: Checkin[]): string | null {
  let latest: string | null = null;
  for (const c of checkins) {
    if (c.status === 'confirmed' && c.reviewedAt && time(c.reviewedAt) > time(latest)) latest = c.reviewedAt;
  }
  return latest;
}

export function confirmedSince(checkins: Checkin[], since: string | null): number {
  return checkins.filter((c) => c.status === 'confirmed' && c.reviewedAt && time(c.reviewedAt) > time(since)).length;
}

/**
 * Compares what the student has now with what they were last rewarded for.
 * First run (no snapshot): no reward, so existing history never pops up.
 * New belt beats a class milestone, which beats a plain confirmed check-in;
 * the returned snapshot consumes everything at once.
 */
export function detectReward(
  previous: RewardsSnapshot | null,
  current: RewardsCurrent,
  checkins: Checkin[],
): { reward: ClassReward | null; snapshot: RewardsSnapshot } {
  const snapshot: RewardsSnapshot = {
    confirmedTotal: current.confirmedTotal,
    beltAwardedAt: current.beltAwardedAt,
    lastReviewedAt: current.lastReviewedAt,
  };
  if (!previous) return { reward: null, snapshot };

  if (current.belt && time(current.beltAwardedAt) > time(previous.beltAwardedAt)) {
    return { reward: { kind: 'belt', belt: current.belt }, snapshot };
  }
  const milestone = milestoneCrossed(previous.confirmedTotal, current.confirmedTotal);
  if (milestone) return { reward: { kind: 'milestone', value: milestone }, snapshot };

  const count = confirmedSince(checkins, previous.lastReviewedAt);
  if (count > 0) return { reward: { kind: 'checkinConfirmed', count }, snapshot };

  return { reward: null, snapshot };
}

export function parseSnapshot(raw: string | null): RewardsSnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<RewardsSnapshot>;
    if (typeof value.confirmedTotal !== 'number') return null;
    return {
      confirmedTotal: value.confirmedTotal,
      beltAwardedAt: value.beltAwardedAt ?? null,
      lastReviewedAt: value.lastReviewedAt ?? null,
    };
  } catch {
    return null;
  }
}
