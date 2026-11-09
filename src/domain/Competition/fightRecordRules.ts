import type { LocalDate } from '@domain/Classes/classesTypes';

import type {
  ChampionshipResult,
  Fight,
  FightMethod,
  FightRecord,
  FightResult,
  FightStage,
  FightTally,
  Medal,
  MedalCount,
  Placement,
} from './fightRecordTypes';

export const FIGHT_RESULTS: { value: FightResult; label: string }[] = [
  { value: 'win', label: 'Vitória' },
  { value: 'loss', label: 'Derrota' },
  { value: 'draw', label: 'Empate' },
];

export const FIGHT_METHODS: { value: FightMethod; label: string }[] = [
  { value: 'points', label: 'Pontos/decisão' },
  { value: 'ko', label: 'Nocaute' },
  { value: 'tko', label: 'Nocaute técnico' },
  { value: 'submission', label: 'Finalização' },
  { value: 'dq', label: 'Desclassificação' },
  { value: 'other', label: 'Outro' },
];

export const FIGHT_STAGES: { value: FightStage; label: string }[] = [
  { value: 'elimination', label: 'Eliminatória' },
  { value: 'quarterfinal', label: 'Quartas' },
  { value: 'semifinal', label: 'Semifinal' },
  { value: 'final', label: 'Final' },
  { value: 'other', label: 'Outra' },
];

export const PLACEMENTS: { value: Placement; label: string }[] = [
  { value: 'gold', label: 'Ouro' },
  { value: 'silver', label: 'Prata' },
  { value: 'bronze', label: 'Bronze' },
  { value: 'none', label: 'Sem pódio' },
];

export const MEDALS: Medal[] = ['gold', 'silver', 'bronze'];

export const FIGHT_OPPONENT_MAX = 120;
export const FIGHT_NOTE_MAX = 500;

const labelOf = <T extends string>(list: { value: T; label: string }[], value: T) =>
  list.find((o) => o.value === value)?.label ?? value;

export const resultLabel = (v: FightResult) => labelOf(FIGHT_RESULTS, v);
export const methodLabel = (v: FightMethod) => labelOf(FIGHT_METHODS, v);
export const stageLabel = (v: FightStage) => labelOf(FIGHT_STAGES, v);
export const placementLabel = (v: Placement) => labelOf(PLACEMENTS, v);

/** Fights and placement are recorded from the championship day on (academy-local date). */
export function canRecordResults(today: LocalDate, eventDate: LocalDate): boolean {
  return eventDate <= today;
}

export function tallyFights(fights: Pick<Fight, 'result'>[]): FightTally {
  const tally: FightTally = { wins: 0, losses: 0, draws: 0 };
  for (const f of fights) {
    if (f.result === 'win') tally.wins += 1;
    else if (f.result === 'loss') tally.losses += 1;
    else tally.draws += 1;
  }
  return tally;
}

/** "8 · 2 · 1" (wins · losses · draws). */
export function formatTally({ wins, losses, draws }: FightTally): string {
  return `${wins} · ${losses} · ${draws}`;
}

/** "8 vitórias, 2 derrotas e 1 empate" (screen readers). */
export function tallyAccessibilityLabel({ wins, losses, draws }: FightTally): string {
  const part = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return `${part(wins, 'vitória', 'vitórias')}, ${part(losses, 'derrota', 'derrotas')} e ${part(draws, 'empate', 'empates')}`;
}

export function countMedals(placements: (Placement | null)[]): MedalCount {
  const count: MedalCount = { gold: 0, silver: 0, bronze: 0 };
  for (const p of placements) if (p && p !== 'none') count[p] += 1;
  return count;
}

export const hasMedals = (m: MedalCount) => m.gold + m.silver + m.bronze > 0;

/** Record per modality from the athlete's history (staff and the athlete see the full history). */
export function recordsByModality(history: ChampionshipResult[], modalityIds: string[] = []): FightRecord[] {
  const ids = [...new Set([...modalityIds, ...history.map((h) => h.modalityId)])];
  return ids.map((modalityId) => {
    const own = history.filter((h) => h.modalityId === modalityId);
    return {
      modalityId,
      ...tallyFights(own.flatMap((h) => h.fights)),
      ...countMedals(own.map((h) => h.placement)),
      championships: own.length,
    };
  });
}

/** One line for a fight: "Vitória · Finalização". */
export function fightTitle(f: Pick<Fight, 'result' | 'method'>): string {
  return `${resultLabel(f.result)} · ${methodLabel(f.method)}`;
}

/** Second line: "Quartas · contra João" (empty when neither is known). */
export function fightDetails(f: Pick<Fight, 'stage' | 'opponentName'>): string {
  return [f.stage ? stageLabel(f.stage) : null, f.opponentName ? `contra ${f.opponentName}` : null]
    .filter(Boolean)
    .join(' · ');
}

/** Optional free text: trimmed, empty → null. */
export function optionalText(text: string): string | null {
  const t = text.trim();
  return t ? t : null;
}
