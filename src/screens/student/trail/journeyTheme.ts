import type { TrailEnvironment } from '@domain/Classes';

/**
 * Colors of the Jornada scenery (vector, react-native-svg). Same style as the
 * mascot: flat, rounded shapes, no outlines, no textures, no gradients. Each
 * element has a base color, a shadow tone and at most one highlight.
 *
 * Edit freely: every color of the scenery lives here.
 */

/** Distance between the centers of two consecutive graduation nodes (points) = height of a section. */
export const JOURNEY_NODE_SPACING = 170;

export interface Tone {
  base: string;
  shadow: string;
  light?: string;
}

export interface JourneyEnvironmentColors {
  /** Ground filling the whole width of the section. */
  ground: string;
  /** Ground patches (manchas). */
  patch: string;
  /** The path (base + shadow under it). */
  path: Tone;
  /** Rocks and stones of this environment. */
  rock: Tone;
}

const PATH: Tone = { base: '#E6CFA0', shadow: '#CDB280' };

export const JOURNEY_ENV_COLORS: Record<TrailEnvironment, JourneyEnvironmentColors> = {
  // 1. Prado
  1: { ground: '#7CB342', patch: '#6A9F38', path: PATH, rock: { base: '#A3A9AE', shadow: '#858B91', light: '#C4C9CD' } },
  // 2. Bambuzal
  2: { ground: '#6FA63A', patch: '#5E8F31', path: PATH, rock: { base: '#9BA19A', shadow: '#7D847C', light: '#BCC2BB' } },
  // 3. Entardecer
  3: { ground: '#D9A066', patch: '#C2854F', path: PATH, rock: { base: '#A9795A', shadow: '#8A5E43', light: '#C79A7A' } },
  // 4. Rochas e lanternas
  4: { ground: '#6E5A6B', patch: '#5A4858', path: PATH, rock: { base: '#8F8292', shadow: '#726575', light: '#ABA0AE' } },
  // 5. Montanhas escuras
  5: { ground: '#3E3448', patch: '#2E2638', path: PATH, rock: { base: '#5C5068', shadow: '#483D53', light: '#76698A' } },
};

export const JOURNEY_COLORS = {
  // Top: stormy sky, mountains, the dojo.
  sky: '#2A1E3F',
  cloud: '#3B2B55',
  mountain: '#241A33',
  lightning: '#B48CFF',
  /** Hill where the dojo stands (above the last section). */
  summit: { ground: '#4A3F57', patch: '#3E3448' },
  dojo: {
    roof: { base: '#2B2233', shadow: '#1C1624', light: '#43384F' } as Tone,
    wall: { base: '#B23A2A', shadow: '#8E2C1F' } as Tone,
    window: '#FFC46B',
    door: '#1C1624',
    stone: { base: '#6A5E74', shadow: '#54495D' } as Tone,
    banner: { base: '#C2412F', shadow: '#972F21' } as Tone,
    pole: '#2B2233',
  },

  // Elements.
  bush: { base: '#4E8A2E', shadow: '#3D7124', light: '#6AA744' } as Tone,
  dryBush: { base: '#6B5A70', shadow: '#2A2233' } as Tone,
  wood: { base: '#A8703F', shadow: '#86562E', light: '#C88F5C' } as Tone,
  /** The fighter painted on the signpost. */
  fighter: '#5B3A20',
  flower: { petal: '#FFFFFF', petalShadow: '#DDE3D3', center: '#FFC93C', stem: '#4E8A2E' },
  bamboo: { base: '#A5CF55', shadow: '#82AF3A', leaf: '#5B9A2C' },
  dryGrass: { base: '#E1BC72', shadow: '#BC944C' } as Tone,
  lantern: { base: '#9A8E9C', shadow: '#786C7B' } as Tone,
  lanternLight: '#FFB74D',
};

/** Overscroll: more sky above the content, more meadow below it. */
export const JOURNEY_OVERSCROLL = { top: JOURNEY_COLORS.sky, bottom: JOURNEY_ENV_COLORS[1].ground };
