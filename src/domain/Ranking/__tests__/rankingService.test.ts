import { QueryClient } from '@tanstack/react-query';

import { supabase } from '@infra/supabase';

import { fetchRanking, rankingQueryKey, type RankingRequest } from '../useCases/useRanking';

jest.mock('@infra/supabase', () => ({ supabase: { from: jest.fn() }, toAppError: (e: unknown) => e }));
const from = supabase.from as jest.Mock;
const period = { from: '2026-11-01', to: '2026-11-28' };
const request = (modalityId: string): RankingRequest => ({ academyId: 'academy', modalityId, startDate: period.from, endDate: period.to });

function query(data: unknown[]) {
  const builder = { select: () => builder, eq: () => builder, order: () => builder,
    then: (resolve: (value: unknown) => void) => Promise.resolve({ data, error: null }).then(resolve) };
  return builder;
}

beforeEach(() => from.mockReset());

it('reads only prepared snapshots and separately protected details', async () => {
  from.mockImplementation((table: string) => query(table === 'ranking_snapshots' ? [{
    academy_id: 'academy', modality_id: 'mt', user_id: 'student', full_name: 'Student', avatar_path: null,
    position: 1, score: 72.5, status: 'ranked', period_to: '2026-11-28',
  }] : table === 'ranking_position_history' ? [{ user_id: 'student', position: 3 }] : []));
  const rows = await fetchRanking(request('mt'));
  expect(from.mock.calls.map(([table]) => table)).toEqual(['ranking_snapshots', 'ranking_details', 'ranking_position_history']);
  expect(rows[0]).toMatchObject({ modalityId: 'mt', rankingScore: 72.5, position: 1, previousPosition: 3 });
});

it('keeps modalities and intervals independent in cache', async () => {
  from.mockImplementation(() => query([]));
  const cache = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  try {
    await cache.fetchQuery({ queryKey: rankingQueryKey('academy', 'mt', period), queryFn: () => fetchRanking(request('mt')) });
    await cache.fetchQuery({ queryKey: rankingQueryKey('academy', 'bjj', period), queryFn: () => fetchRanking(request('bjj')) });
    expect(from).toHaveBeenCalledTimes(4);
    expect(rankingQueryKey('academy', 'mt', period)).not.toEqual(rankingQueryKey('academy', 'mt', { from: '2026-10-01', to: '2026-10-28' }));
  } finally { cache.clear(); }
});
