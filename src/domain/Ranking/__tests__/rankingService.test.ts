import { QueryClient } from '@tanstack/react-query';

import { supabase } from '@infra/supabase';

import { fetchRanking, rankingQueryKey, type RankingRequest } from '../useCases/useRanking';

jest.mock('@infra/supabase', () => ({ supabase: { rpc: jest.fn() }, toAppError: (e: unknown) => e }));
const rpc = supabase.rpc as jest.Mock;
const period = { from: '2026-11-01', to: '2026-11-28' };
const request = (modalityId: string): RankingRequest => ({ academyId: 'academy', modalityId, startDate: period.from, endDate: period.to });
const row = (modalityId: string, done = true) => ({
  user_id: 'student', full_name: 'Student', avatar_path: null, modality_id: modalityId,
  today: '2026-11-29', period_from: period.from, period_to: period.to,
  attendance: [{ id: `${modalityId}:class`, day: '2026-11-01', done }],
  hydration: [{ day: '2026-11-01', known: true, eligible: true, done: true }],
});

beforeEach(() => rpc.mockReset());

it('requires modality and dates in the backend request; no global score is fetched', async () => {
  rpc.mockResolvedValue({ data: [row('mt')], error: null });
  await fetchRanking(request('mt'));
  expect(rpc).toHaveBeenCalledWith('academy_ranking_facts', {
    p_academy_id: 'academy', p_modality_id: 'mt', p_from: period.from, p_to: period.to,
  });
});

it('uses different cache entries and different calculations on modality changes', async () => {
  rpc.mockImplementation((_name, args) => Promise.resolve({ data: [row(args.p_modality_id, args.p_modality_id === 'mt')], error: null }));
  const cache = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  try {
    const mt = await cache.fetchQuery({ queryKey: rankingQueryKey('academy', 'mt', period), queryFn: () => fetchRanking(request('mt')) });
    const bjj = await cache.fetchQuery({ queryKey: rankingQueryKey('academy', 'bjj', period), queryFn: () => fetchRanking(request('bjj')) });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(mt[0]).toMatchObject({ modalityId: 'mt', attendanceRate: 1, penaltyPoints: 0, rankingScore: 100 });
    expect(bjj[0]).toMatchObject({ modalityId: 'bjj', attendanceRate: 0, penaltyPoints: 5, rankingScore: 35 });
    expect(cache.getQueryData(rankingQueryKey('academy', 'mt', period))).toEqual(mt);
  } finally { cache.clear(); }
});

it('never accepts a backend response carrying another modality', async () => {
  rpc.mockResolvedValue({ data: [row('mt')], error: null });
  await expect(fetchRanking(request('bjj'))).rejects.toThrow('modalidade solicitada');
});

it('keeps different intervals independent in cache', () => {
  expect(rankingQueryKey('academy', 'mt', period)).not.toEqual(rankingQueryKey('academy', 'mt', { from: '2026-10-01', to: '2026-10-28' }));
});
