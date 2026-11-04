import {
  crossedGoal,
  isValidBottle,
  lastLogOfDay,
  localDate,
  logsOfDay,
  parseDecimal,
  pendingDeletes,
  pendingUpserts,
  pruneLogs,
  remoteLogsToAdd,
  totalMl,
} from '../waterRules';
import type { WaterLog } from '../waterTypes';

const SP = 'America/Sao_Paulo'; // UTC−3, no DST

const log = (id: string, loggedAt: string, extra: Partial<WaterLog> = {}): WaterLog => ({
  id,
  userId: 'u1',
  amountMl: 500,
  loggedAt,
  source: 'app',
  synced: false,
  deleted: false,
  ...extra,
});

describe('localDate', () => {
  it('uses the profile time zone, not UTC', () => {
    // 02:30 UTC on the 5th is still 23:30 of the 4th in São Paulo.
    expect(localDate('2026-11-05T02:30:00.000Z', SP)).toBe('2026-11-04');
    expect(localDate('2026-11-05T03:00:00.000Z', SP)).toBe('2026-11-05');
    expect(localDate('2026-11-05T02:30:00.000Z', 'UTC')).toBe('2026-11-05');
  });
});

describe('day totals', () => {
  const logs = [
    log('a', '2026-11-04T12:00:00.000Z'),
    log('b', '2026-11-05T02:30:00.000Z', { source: 'widget' }), // 23:30 local, same day
    log('c', '2026-11-05T03:00:00.000Z'), // next local day
    log('d', '2026-11-04T13:00:00.000Z', { deleted: true }), // undone
  ];

  it('counts the local day, from app and widget, without undone logs', () => {
    const today = logsOfDay(logs, '2026-11-04', SP);
    expect(today.map((l) => l.id)).toEqual(['a', 'b']);
    expect(totalMl(today)).toBe(1000);
  });

  it('a new day starts at zero at local midnight', () => {
    expect(totalMl(logsOfDay(logs, '2026-11-05', SP))).toBe(500);
  });

  it('undo targets the latest log of the day, wherever it came from', () => {
    expect(lastLogOfDay(logs, '2026-11-04', SP)?.id).toBe('b');
    expect(lastLogOfDay([], '2026-11-04', SP)).toBeNull();
  });
});

describe('sync', () => {
  it('upserts new logs and deletes undone ones', () => {
    const logs = [
      log('new', '2026-11-04T12:00:00.000Z'),
      log('sent', '2026-11-04T12:00:00.000Z', { synced: true }),
      log('undone', '2026-11-04T12:00:00.000Z', { synced: true, deleted: true }),
    ];
    expect(pendingUpserts(logs).map((l) => l.id)).toEqual(['new']);
    expect(pendingDeletes(logs).map((l) => l.id)).toEqual(['undone']);
  });

  it('restores server logs missing on the device, never undone ones', () => {
    const local = [log('kept', '2026-11-04T12:00:00.000Z'), log('undone', '2026-11-04T12:00:00.000Z', { deleted: true })];
    const remote = [
      log('kept', '2026-11-04T12:00:00.000Z', { synced: true }),
      log('undone', '2026-11-04T12:00:00.000Z', { synced: true }),
      log('other-phone', '2026-11-04T13:00:00.000Z', { synced: true }),
    ];
    expect(remoteLogsToAdd(local, remote).map((l) => [l.id, l.synced])).toEqual([['other-phone', true]]);
  });

  it('prunes only synced logs older than the retention window', () => {
    const now = new Date('2026-11-20T12:00:00.000Z');
    const logs = [
      log('old-synced', '2026-11-01T12:00:00.000Z', { synced: true }),
      log('old-pending', '2026-11-01T12:00:00.000Z'),
      log('recent', '2026-11-19T12:00:00.000Z', { synced: true }),
    ];
    expect(pruneLogs(logs, now).map((l) => l.id)).toEqual(['old-pending', 'recent']);
  });
});

describe('goal feedback moment', () => {
  it('fires only when a change crosses the goal', () => {
    expect(crossedGoal(2000, 2500, 2450)).toBe(true);
    expect(crossedGoal(2500, 3000, 2450)).toBe(false);
    expect(crossedGoal(0, 500, null)).toBe(false);
  });
});

describe('form parsing', () => {
  it('reads Brazilian decimals', () => {
    expect(parseDecimal('70,5')).toBe(70.5);
    expect(parseDecimal(' 82 ')).toBe(82);
    expect(parseDecimal('abc')).toBeNull();
  });

  it('bottle within the database limits', () => {
    expect(isValidBottle(500)).toBe(true);
    expect(isValidBottle(49)).toBe(false);
    expect(isValidBottle(5001)).toBe(false);
    expect(isValidBottle(500.5)).toBe(false);
  });
});
