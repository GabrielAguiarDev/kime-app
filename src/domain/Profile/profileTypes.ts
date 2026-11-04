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

/** Water setup (Perfil → Água). */
export interface BodyAndBottle {
  weightKg: number | null;
  heightCm: number | null;
  bottleMl: number | null;
}
