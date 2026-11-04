export interface Profile {
  id: string;
  fullName: string;
  weightKg: number | null;
  heightCm: number | null;
  /** Null until the bottle is set up (the water widget needs it). */
  bottleMl: number | null;
  /** IANA zone: defines "today" for water. */
  timeZone: string;
}

/** Water setup (Perfil → Água). */
export interface BodyAndBottle {
  weightKg: number | null;
  heightCm: number | null;
  bottleMl: number | null;
}
