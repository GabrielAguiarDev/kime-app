import type { ReactElement } from 'react';

import { useRanking } from '@domain/Ranking';
import { RankingView } from '../../../screens/ranking/RankingScreen';

// Inspect the view's React elements without adding a native renderer dependency.
let mockStaff = false;
let mockPicked: string | null = null;
let mockStudentModality: string | null = 'mt';
jest.mock('react', () => {
  const actual = jest.requireActual('react');
  let calls = 0;
  return {
    ...actual,
    // useState order in RankingView: picked, picking; RankingRow: expanded.
    useState: (initial: unknown) => {
      calls += 1;
      if (calls % 2 === 1 && initial === null) return [mockPicked, (v: string) => { mockPicked = v; }];
      return [initial, () => {}];
    },
  };
});
jest.mock('expo-router', () => ({ router: {} }));
jest.mock('@infra', () => ({ errorMessage: () => 'Erro' }));
jest.mock('@components', () =>
  Object.fromEntries(
    ['Avatar', 'BottomSheet', 'Box', 'Button', 'PersonRow', 'Card', 'EmptyState', 'FilterChips', 'Icon', 'LoadError', 'Screen', 'SelectionCard', 'Text'].map(
      (name) => [name, name],
    ),
  ),
);
jest.mock('@screens/professor/shared', () => ({ SheetForm: 'SheetForm' }));
jest.mock('@domain/Classes', () => ({ useAcademyToday: () => ({ data: '2026-11-29', isLoading: false, isError: false }) }));
jest.mock('@domain/Profile', () => ({ useMyProfile: () => ({ data: { showInRanking: true } }) }));
jest.mock('@services/activeGym', () => ({ useActiveGym: () => ({ isStaff: mockStaff }) }));
jest.mock('@services/activeModality', () => ({
  useActiveModality: () => ({ selected: mockStudentModality ? { id: mockStudentModality } : null }),
}));
jest.mock('@services/session', () => ({ useSession: () => ({ userId: 'student' }) }));
jest.mock('@domain/Ranking', () => ({
  ...jest.requireActual('@domain/Ranking/rankingRules'),
  ...jest.requireActual('@domain/Ranking/rankingConfig'),
  useRanking: jest.fn(),
  useRankingModalities: () => ({
    data: [{ id: 'mt', name: 'Muay Thai' }, { id: 'bjj', name: 'BJJ' }],
    isLoading: false,
    isError: false,
  }),
}));

function elements(node: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const element = node as ReactElement<Record<string, unknown>>;
  return [element, ...elements(element.props.children)];
}

const entry = (modalityId: string) => ({ modalityId, userId: 'student', fullName: 'Student', position: 1, rankingScore: 90, status: 'ranked' });
const period = { from: '2026-11-01', to: '2026-11-28' };

beforeEach(() => {
  (useRanking as jest.Mock).mockImplementation((_a, modality) => ({ data: [entry(modality)], isLoading: false, isError: false }));
  mockPicked = null;
});

it('the student ranking follows the modality selected in the header, without a picker', () => {
  mockStaff = false;
  mockStudentModality = 'bjj';
  const tree = elements(RankingView({ academyId: 'academy' }));
  expect(useRanking).toHaveBeenLastCalledWith('academy', 'bjj', period);
  expect(tree.find((e) => e.props.accessibilityLabel === 'Filtros')).toBeUndefined();
});

it('staff always rank one modality: the first by default, then the picked one (no "Todas")', () => {
  mockStaff = true;
  const first = elements(RankingView({ academyId: 'academy' }));
  expect(useRanking).toHaveBeenLastCalledWith('academy', 'mt', period);
  const chips = first.find((e) => e.props.accessibilityLabel === 'Filtros')!;
  expect((chips.props.chips as { label: string }[]).map((c) => c.label)).toEqual(['Muay Thai']);
  const options = first.filter((e) => e.type === 'SelectionCard').map((e) => e.props.label);
  expect(options).toEqual(['Muay Thai', 'BJJ']);
  mockPicked = 'bjj';
  RankingView({ academyId: 'academy' });
  expect(useRanking).toHaveBeenLastCalledWith('academy', 'bjj', period);
});
