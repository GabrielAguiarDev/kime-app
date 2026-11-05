import type { ReactElement } from 'react';

import { useRanking } from '@domain/Ranking';
import { RankingView } from '../../../screens/ranking/RankingScreen';

// Inspect the view's React elements without adding a native renderer dependency.
// The hook boundary is mocked; selecting a choice updates state before rerender.
let mockSelected: string | null = null;
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: () => [mockSelected, (value: string) => { mockSelected = value; }],
}));
jest.mock('expo-router', () => ({ router: {} }));
jest.mock('@components', () => Object.fromEntries(['Avatar','Box','Card','ChoiceRow','EmptyState','Icon','LoadError','Screen','Text','TextButton'].map((name) => [name, name])));
jest.mock('@domain/Classes', () => ({ useAcademyToday: () => ({ data: '2026-11-29', isLoading: false, isError: false }) }));
jest.mock('@domain/Profile', () => ({ useMyProfile: () => ({ data: { showInRanking: true } }) }));
jest.mock('@services/activeGym', () => ({ useActiveGym: () => ({ isStaff: false }) }));
jest.mock('@services/session', () => ({ useSession: () => ({ userId: 'student' }) }));
jest.mock('@domain/Ranking/useCases/useModalityEnrollments', () => ({
  useRankingModalities: () => ({ data: [{ id: 'mt', name: 'Muay Thai' }, { id: 'bjj', name: 'BJJ' }], isLoading: false, isError: false }),
}));
jest.mock('@domain/Ranking', () => ({
  ...jest.requireActual('@domain/Ranking/rankingRules'),
  ...jest.requireActual('@domain/Ranking/rankingConfig'),
  useRanking: jest.fn(),
}));

function elements(node: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const element = node as ReactElement<Record<string, unknown>>;
  return [element, ...elements(element.props.children)];
}

it('selection replaces the rows, score, frequency, penalties, position and qualifying status', () => {
  const use = useRanking as jest.Mock;
  const mt = { modalityId: 'mt', userId: 'student', fullName: 'Student', position: 1, rankingScore: 100, attendanceRate: 1, hydrationRate: 1, penaltyPoints: 0, status: 'ranked' };
  const bjj = { ...mt, modalityId: 'bjj', position: null, rankingScore: 35, attendanceRate: 0, penaltyPoints: 5, status: 'qualifying' };
  use.mockImplementation((_academy, modality) => ({ data: modality === 'mt' ? [mt] : [bjj], isLoading: false, isError: false }));
  mockSelected = null;
  const first = elements(RankingView({ academyId: 'academy' }));
  expect(first.find((e) => e.props.entry)?.props.entry).toEqual(mt);
  const choice = first.find((e) => e.props.accessibilityLabel === 'Modalidade do ranking')!;
  expect(choice.props.value).toBe('mt');
  (choice.props.onChange as (value: string) => void)('bjj');
  const second = elements(RankingView({ academyId: 'academy' }));
  expect(second.find((e) => e.props.entry)?.props.entry).toEqual(bjj);
  expect(second.find((e) => e.props.accessibilityLabel === 'Modalidade do ranking')?.props.value).toBe('bjj');
  expect(use).toHaveBeenLastCalledWith('academy', 'bjj', { from: '2026-11-01', to: '2026-11-28' });
});
