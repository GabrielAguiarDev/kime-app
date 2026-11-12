import type { LocalDate } from '@domain/Classes';

/**
 * A notice of the academy ("Avisos"). Owner and instructors publish; the
 * audience is everyone (`modalityId` null) or the students of one modality.
 */
export interface Announcement {
  id: string;
  academyId: string;
  body: string;
  /** Null = every member. */
  modalityId: string | null;
  pinned: boolean;
  /** Last day students see it (academy calendar, inclusive); null = no end. */
  expiresOn: LocalDate | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** Null when the author's account no longer exists. */
  authorName: string | null;
  authorAvatarPath: string | null;
}

export interface AnnouncementInput {
  body: string;
  modalityId: string | null;
  pinned: boolean;
  expiresOn: LocalDate | null;
}
