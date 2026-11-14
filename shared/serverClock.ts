export interface ClockSample { sentAt: number; receivedAt: number; serverAt: number }
export function clockOffset(sample: ClockSample): number {
  return sample.serverAt - (sample.sentAt + sample.receivedAt) / 2;
}
export function bestClockOffset(samples: ClockSample[]): number {
  if (!samples.length) throw new Error('No clock samples');
  const best = samples.reduce((a, b) => b.receivedAt - b.sentAt < a.receivedAt - a.sentAt ? b : a);
  return clockOffset(best);
}
export function createServerClock(fetchServerNow: () => Promise<number>) {
  let offset = 0;
  return {
    now: () => Date.now() + offset,
    async sync(count = 5) {
      const samples: ClockSample[] = [];
      for (let i = 0; i < count; i++) {
        const sentAt = Date.now();
        const serverAt = await fetchServerNow();
        samples.push({ sentAt, receivedAt: Date.now(), serverAt });
      }
      offset = bestClockOffset(samples);
      return offset;
    },
  };
}
