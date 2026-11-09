import {
  canRecordResults,
  countMedals,
  fightDetails,
  fightTitle,
  formatTally,
  optionalText,
  recordsByModality,
  tallyAccessibilityLabel,
  tallyFights,
} from '../fightRecordRules';
import type { ChampionshipResult, Fight } from '../fightRecordTypes';

const fight = (result: Fight['result'], extra: Partial<Fight> = {}): Fight => ({
  id: Math.random().toString(36),
  result,
  method: 'points',
  stage: null,
  opponentName: null,
  note: null,
  createdAt: '2026-11-01T10:00:00Z',
  ...extra,
});

const champ = (modalityId: string, placement: ChampionshipResult['placement'], fights: Fight[]): ChampionshipResult => ({
  entryId: Math.random().toString(36),
  championshipId: 'c',
  modalityId,
  name: 'Copa',
  eventDate: '2026-10-01',
  location: '',
  placement,
  fights,
});

describe('fight record rules', () => {
  it('records from the championship day on', () => {
    expect(canRecordResults('2026-11-09', '2026-11-10')).toBe(false);
    expect(canRecordResults('2026-11-09', '2026-11-09')).toBe(true);
    expect(canRecordResults('2026-11-09', '2026-11-01')).toBe(true);
  });

  it('tallies wins, losses and draws', () => {
    const tally = tallyFights([fight('win'), fight('win'), fight('loss'), fight('draw')]);
    expect(tally).toEqual({ wins: 2, losses: 1, draws: 1 });
    expect(formatTally({ wins: 8, losses: 2, draws: 1 })).toBe('8 · 2 · 1');
    expect(tallyAccessibilityLabel({ wins: 1, losses: 0, draws: 2 })).toBe('1 vitória, 0 derrotas e 2 empates');
  });

  it('counts medals, ignoring no podium and unrecorded', () => {
    expect(countMedals(['gold', 'gold', 'bronze', 'none', null])).toEqual({ gold: 2, silver: 0, bronze: 1 });
  });

  it('groups the record per modality, keeping modalities without results', () => {
    const records = recordsByModality(
      [champ('bjj', 'gold', [fight('win'), fight('win')]), champ('bjj', 'none', [fight('loss')]), champ('mma', 'silver', [])],
      ['bjj', 'boxe'],
    );
    expect(records).toEqual([
      { modalityId: 'bjj', wins: 2, losses: 1, draws: 0, gold: 1, silver: 0, bronze: 0, championships: 2 },
      { modalityId: 'boxe', wins: 0, losses: 0, draws: 0, gold: 0, silver: 0, bronze: 0, championships: 0 },
      { modalityId: 'mma', wins: 0, losses: 0, draws: 0, gold: 0, silver: 1, bronze: 0, championships: 1 },
    ]);
  });

  it('describes a fight', () => {
    const f = fight('win', { method: 'submission', stage: 'quarterfinal', opponentName: 'João' });
    expect(fightTitle(f)).toBe('Vitória · Finalização');
    expect(fightDetails(f)).toBe('Quartas · contra João');
    expect(fightDetails(fight('loss'))).toBe('');
  });

  it('turns blank optional text into null', () => {
    expect(optionalText('  ')).toBeNull();
    expect(optionalText(' João ')).toBe('João');
  });
});
