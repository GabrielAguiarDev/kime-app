import { markSynced, pendingLogs, pruneLogs, totalForDay } from '../waterRules';
import type { WaterLog } from '../waterTypes';

const at = (iso: string, amountMl: number, synced = false, id = iso): WaterLog => ({
  id,
  amountMl,
  loggedAt: new Date(iso).toISOString(),
  synced,
});

describe('waterRules', () => {
  it('sums only the given local day', () => {
    const logs = [at('2026-11-04T08:00:00', 300), at('2026-11-04T21:00:00', 500), at('2026-11-03T22:00:00', 700)];
    expect(totalForDay(logs, new Date('2026-11-04T12:00:00'))).toBe(800);
  });

  it('marks only the sent ids as synced, keeping logs added meanwhile pending', () => {
    const logs = [at('2026-11-04T08:00:00', 300, false, 'a'), at('2026-11-04T09:00:00', 200, false, 'b')];
    expect(pendingLogs(markSynced(logs, ['a'])).map((l) => l.id)).toEqual(['b']);
  });

  it('never prunes unsynced logs', () => {
    const now = new Date('2026-11-20T12:00:00');
    const logs = [at('2026-11-01T08:00:00', 300, false, 'old-pending'), at('2026-11-01T09:00:00', 200, true, 'old-synced'),
      at('2026-11-19T09:00:00', 200, true, 'recent')];
    expect(pruneLogs(logs, now).map((l) => l.id)).toEqual(['old-pending', 'recent']);
  });
});
