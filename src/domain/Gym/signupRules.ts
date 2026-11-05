import type { BeltColorKey } from '@domain/Classes';

/**
 * Academy sign-up, step 4 (modalities). Options offered as cards; "Outra"
 * adds a typed name. Jiu-jitsu comes with the adult belts suggested (no class
 * counts); every other modality starts empty and is set up later in
 * "Modalidades e faixas".
 */
export const SIGNUP_MODALITIES = ['Jiu-jitsu', 'Muay Thai', 'Judô', 'Boxe', 'MMA', 'Karatê', 'Taekwondo', 'Wrestling'];

/** Modalities that usually have belts: their "Usa faixas" switch starts on. */
const BELTED_BY_DEFAULT = new Set(['jiujitsu', 'judo', 'karate', 'taekwondo']);

export const JIU_JITSU_ADULT_BELTS: BeltColorKey[] = ['white', 'blue', 'purple', 'brown', 'black'];

export const MODALITY_NAME_MAX = 60;
export const ACADEMY_NAME_MIN = 2;
export const ACADEMY_NAME_MAX = 80;
export const MAX_SIGNUP_MODALITIES = 20;

export const normalizeModalityName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

const isJiuJitsu = (name: string) => ['jiujitsu', 'bjj'].includes(normalizeModalityName(name));

export function usesBeltsByDefault(name: string): boolean {
  return BELTED_BY_DEFAULT.has(normalizeModalityName(name));
}

/** The belts suggested for a modality (only Jiu-jitsu, and only when it uses belts). */
export function suggestedBelts(name: string, usesBelts: boolean): BeltColorKey[] {
  return usesBelts && isJiuJitsu(name) ? JIU_JITSU_ADULT_BELTS : [];
}

export function isValidAcademyName(name: string): boolean {
  const n = name.trim().length;
  return n >= ACADEMY_NAME_MIN && n <= ACADEMY_NAME_MAX;
}

export interface SignupModality {
  name: string;
  usesBelts: boolean;
}

/** Payload of create_academy_with_setup (p_modalities), in the order chosen. */
export interface SetupModality {
  name: string;
  uses_belts: boolean;
  belts: { primary_color: BeltColorKey; tip_color: null }[];
}

export function toSetupModalities(selected: SignupModality[]): SetupModality[] {
  return selected.map((m) => ({
    name: m.name.trim(),
    uses_belts: m.usesBelts,
    belts: suggestedBelts(m.name, m.usesBelts).map((primary_color) => ({ primary_color, tip_color: null })),
  }));
}

/** 1..20 modalities, names 1..60 chars, no repeats (case, accents and spaces ignored). */
export function isValidModalitySelection(selected: SignupModality[]): boolean {
  if (selected.length < 1 || selected.length > MAX_SIGNUP_MODALITIES) return false;
  const names = selected.map((m) => m.name.trim());
  if (names.some((n) => n.length < 1 || n.length > MODALITY_NAME_MAX)) return false;
  return new Set(names.map(normalizeModalityName)).size === names.length;
}
