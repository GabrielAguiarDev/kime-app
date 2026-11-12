import { pause, resume, seekTo, startClock, timeline } from '../timer';
import { tvTimerAt, type TvTimerSnapshot } from '../tvTimer';
import { bestClockOffset } from '../serverClock';

const config = { rounds: 2, roundSeconds: 20, restSeconds: 10, warningSeconds: 5 };
const initial = (): TvTimerSnapshot => ({ status: 'running', title: 'Boxe', config, clock: startClock(1000) });
test('start, phases, warning and finish', () => {
  expect(tvTimerAt(initial(), 1000).state.phase).toBe('prep');
  expect(tvTimerAt(initial(), 11000).state.phase).toBe('round');
  expect(tvTimerAt(initial(), 26000).state.warning).toBe(true);
  expect(tvTimerAt(initial(), 31000).state.phase).toBe('rest');
  expect(tvTimerAt(initial(), 41000).state.round).toBe(2);
  expect(tvTimerAt(initial(), 61000).finished).toBe(true);
});
test('pause and resume preserve remaining time', () => {
  const s = initial();
  s.clock = pause(s.clock, 15000); s.status = 'paused';
  expect(tvTimerAt(s, 50000).state.remainingMs).toBe(16000);
  s.clock = resume(s.clock, 50000); s.status = 'running';
  expect(tvTimerAt(s, 50000).state.remainingMs).toBe(16000);
});
test('skip seeks to the next phase', () => {
  const s = initial();
  s.clock = seekTo(s.clock, timeline(config), 2, 12000);
  expect(tvTimerAt(s, 12000).state.phase).toBe('rest');
});
test('lowest RTT controls clock offset', () => {
  expect(bestClockOffset([
    { sentAt: 0, receivedAt: 100, serverAt: 1010 },
    { sentAt: 100, receivedAt: 120, serverAt: 1110 },
  ])).toBe(1000);
});
