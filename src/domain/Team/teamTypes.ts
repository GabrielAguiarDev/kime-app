import type { BeltLook } from '@domain/Classes';
import type { MembershipRole } from '@domain/Membership';

/** A modality the viewer and the classmate share. */
export interface SharedModality {
  modalityId: string;
  belt: BeltLook | null;
  isCompetitor: boolean;
}

/**
 * A member a student may see (classmates()): the academy's staff and the
 * students who share a modality. Name, photo, role and belts only: no health
 * data, no attendance.
 */
export interface Classmate {
  userId: string;
  fullName: string;
  avatarPath: string | null;
  role: MembershipRole;
  memberSince: string;
  /** Modalities in common (empty for staff). */
  modalities: SharedModality[];
}

/** A competitor entered in a championship (name, photo and belt in its modality). */
export interface ChampionshipCompetitor {
  userId: string;
  fullName: string;
  avatarPath: string | null;
  belt: BeltLook | null;
}

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** "novembro de 2026" (the member's join month, device time zone). */
export function memberSinceLabel(iso: string): string {
  const d = new Date(iso);
  return `${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}`;
}
