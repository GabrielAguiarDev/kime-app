import type { BeltLook, Modality } from '@domain/Classes/classesTypes';
import type { TeachingGroup } from '@domain/Instructor/instructorRules';

/** What the screen draws, from the profile (or the DEV demo). */
export interface ProfileView {
  bio: string | null;
  belts: { modality: Modality; belt: BeltLook }[];
  memberSince: string;
  groups: TeachingGroup[];
  /** Schedule highlighted as the next class (accent) and its "hoje 19:00" label. */
  next: { scheduleId: string; label: string } | null;
}
