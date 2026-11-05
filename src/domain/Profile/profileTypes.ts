export interface Profile {
  id: string;
  fullName: string;
  weightKg: number | null;
  heightCm: number | null;
  /** Null until the bottle is set up (the water widget needs it). */
  bottleMl: number | null;
  /** IANA zone: defines "today" for water. */
  timeZone: string;
  /** Photo in the private `avatars` bucket; null = initials. */
  avatarPath: string | null;
  sex: Sex | null;
  /** `YYYY-MM-DD`. */
  birthDate: string | null;
  /** Shows in the academy ranking (Perfil switch). */
  showInRanking: boolean;
  showCheckinsToPeers: boolean;
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
}

/** Water setup (Sua garrafa): weight and bottle. Height lives in Meus dados only. */
export interface BodyAndBottle {
  weightKg: number | null;
  bottleMl: number | null;
}
