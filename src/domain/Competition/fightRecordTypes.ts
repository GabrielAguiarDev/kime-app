import type { LocalDate } from '@domain/Classes/classesTypes';

export type FightResult = 'win' | 'loss' | 'draw';
export type FightMethod = 'points' | 'ko' | 'tko' | 'submission' | 'dq' | 'other';
export type FightStage = 'elimination' | 'quarterfinal' | 'semifinal' | 'final' | 'other';
/** Placement of an athlete in a championship ("none" = no podium; null = not recorded). */
export type Placement = 'gold' | 'silver' | 'bronze' | 'none';
export type Medal = Exclude<Placement, 'none'>;

/** One fight of an athlete in a championship. */
export interface Fight {
  id: string;
  result: FightResult;
  method: FightMethod;
  stage: FightStage | null;
  opponentName: string | null;
  note: string | null;
  createdAt: string;
}

export interface FightInput {
  result: FightResult;
  method: FightMethod;
  stage: FightStage | null;
  opponentName: string | null;
  note: string | null;
}

/** Staff, championship page: one entered athlete with placement and fights. */
export interface EntryResults {
  entryId: string;
  athleteId: string;
  placement: Placement | null;
  fights: Fight[];
}

/** A championship (held or today) in the athlete's history. */
export interface ChampionshipResult {
  entryId: string;
  championshipId: string;
  modalityId: string;
  name: string;
  eventDate: LocalDate;
  location: string;
  placement: Placement | null;
  /** Previous championship ("Registro anterior"): before the app, only in this athlete's history. */
  isHistorical: boolean;
  fights: Fight[];
}

export interface FightTally {
  wins: number;
  losses: number;
  draws: number;
}

export interface MedalCount {
  gold: number;
  silver: number;
  bronze: number;
}

/** Record ("Cartel") of an athlete in one modality. */
export interface FightRecord extends FightTally, MedalCount {
  modalityId: string;
  championships: number;
}

/** Summarized record before the app ("Antes do Kimi") in one modality. Staff write it; the athlete reads. */
export interface PreviousRecord extends FightTally, MedalCount {
  modalityId: string;
}

/** Staff: a previous championship of one athlete (date strictly in the past). */
export interface PreviousChampionshipInput {
  modalityId: string;
  name: string;
  eventDate: LocalDate;
  location: string;
}
