import { graduationTrail, type ModalityBelt } from '@domain/Classes';

/**
 * DEV ONLY (__DEV__): sample trail with 7 sections to see the whole Jornada —
 * Fundamentos, Branca, Branca/ponta vermelha, Azul, Roxa, Marrom, Preta. The
 * sample student is in the third section (Branca/ponta vermelha) with 4 of 10
 * classes: the earlier ones done, the later ones locked. Never saved anywhere.
 */
const belt = (id: string, position: number, primary: ModalityBelt['primary'], tip: ModalityBelt['tip']): ModalityBelt => ({
  id: `demo-${id}`,
  modalityId: 'demo',
  position,
  primary,
  tip,
  classesRequired: 10,
});

const DEMO_BELTS: ModalityBelt[] = [
  belt('branca', 1, 'white', null),
  belt('branca-vermelha', 2, 'white', 'red'),
  belt('azul', 3, 'blue', null),
  belt('roxa', 4, 'purple', null),
  belt('marrom', 5, 'brown', null),
  belt('preta', 6, 'black', null),
];

export const DEMO_TRAIL = graduationTrail(DEMO_BELTS, 'demo-branca-vermelha', 4);
/** Confirmed classes in the modality: the two finished sections + the current one. */
export const DEMO_MODALITY_TOTAL = 24;
