import type { LocalDate } from '@domain/Classes/classesTypes';
import { daysBetween, formatLocalDate } from '@domain/Competition/competitionRules';
import { localDate } from '@domain/Water/waterRules';

import type { Announcement } from './announcementsTypes';

export const ANNOUNCEMENT_BODY_MIN = 2;
export const ANNOUNCEMENT_BODY_MAX = 1000;
/** An unpinned notice stays on the student's Início for this many days. */
export const HOME_ANNOUNCEMENT_DAYS = 7;

/** Past its last day (students no longer see it; staff do). */
export function isExpired(a: Pick<Announcement, 'expiresOn'>, today: LocalDate): boolean {
  return a.expiresOn !== null && a.expiresOn < today;
}

/** Splits into current (feed order kept: pinned first, newest first) and expired. */
export function splitAnnouncements(list: Announcement[], today: LocalDate): { current: Announcement[]; expired: Announcement[] } {
  return {
    current: list.filter((a) => !isExpired(a, today)),
    expired: list.filter((a) => isExpired(a, today)),
  };
}

/**
 * The notice on the student's Início: the first current one that is pinned or
 * was published in the last HOME_ANNOUNCEMENT_DAYS days (an old notice does
 * not stay there forever; it remains in "Avisos").
 */
export function homeAnnouncement(list: Announcement[], today: LocalDate, timeZone: string): Announcement | null {
  return (
    list.find(
      (a) => !isExpired(a, today) && (a.pinned || daysBetween(localDate(a.createdAt, timeZone), today) < HOME_ANNOUNCEMENT_DAYS),
    ) ?? null
  );
}

/** "Hoje", "Ontem", "Há 3 dias", then the date. */
export function publishedLabel(createdAt: string, today: LocalDate, timeZone: string): string {
  const day = localDate(createdAt, timeZone);
  const days = daysBetween(day, today);
  if (days <= 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return `Há ${days} dias`;
  return formatLocalDate(day);
}

/** "Até 20 nov 2026" / "Encerrado em 20 nov 2026"; null without a last day. */
export function expiryLabel(a: Pick<Announcement, 'expiresOn'>, today: LocalDate): string | null {
  if (!a.expiresOn) return null;
  return isExpired(a, today) ? `Encerrado em ${formatLocalDate(a.expiresOn)}` : `Até ${formatLocalDate(a.expiresOn)}`;
}

/** Valid text length after trimming. */
export function isValidAnnouncementBody(body: string): boolean {
  const length = body.trim().length;
  return length >= ANNOUNCEMENT_BODY_MIN && length <= ANNOUNCEMENT_BODY_MAX;
}

