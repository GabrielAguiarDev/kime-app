export interface Profile {
  id: string;
  fullName: string;
  weightKg: number | null;
  heightCm: number | null;
  /** Arm span, fingertip to fingertip (cm). */
  reachCm: number | null;
  /** Null until the bottle is set up (the water widget needs it). */
  bottleMl: number | null;
  personalWaterGoalMl?: number | null;
  /** IANA zone: defines "today" for water. */
  timeZone: string;
  /** Photo in the private `avatars` bucket; null = initials. */
  avatarPath: string | null;
  sex: Sex | null;
  /** `YYYY-MM-DD`. */
  birthDate: string | null;
  /** Shows in the academy ranking (Perfil switch). */
  showInRanking: boolean;
}

export type Sex = 'female' | 'male' | 'unspecified';

/** "Meus dados" form. */
export interface PersonalData {
  fullName: string;
  sex: Sex | null;
  /** `YYYY-MM-DD`. */
  birthDate: string | null;
  weightKg: number | null;
  heightCm: number | null;
  reachCm: number | null;
}

/** Water setup (Garrafa e meta de água): bottle and personal goal. Body data lives in Meus dados only. */
export interface BodyAndBottle {
  bottleMl: number | null;
  personalWaterGoalMl?: number | null;
}

/** Body data of a member, read by staff (only when the member competes). */
export interface BodyData {
  weightKg: number | null;
  heightCm: number | null;
  reachCm: number | null;
}
