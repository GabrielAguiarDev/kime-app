import type { ReactNode } from 'react';
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { JOURNEY_COLORS as C, type Tone } from './journeyTheme';

/**
 * Scenery elements of the Jornada, drawn in react-native-svg in the mascot's
 * style: flat rounded shapes, no outlines, base color + shadow tone + at most
 * one highlight. Each one is drawn in local coordinates with the origin at
 * its BOTTOM CENTER (y grows down, so the shape lives at negative y), inside
 * the box of ELEMENT_SIZE.
 */
export type JourneyElementKind =
  | 'bush'
  | 'smallStone'
  | 'flower'
  | 'signpost'
  | 'bamboo'
  | 'dummy'
  | 'carvedRock'
  | 'dryGrass'
  | 'lantern'
  | 'cairn'
  | 'bigRock'
  | 'pointyRock'
  | 'dryBush';

/** Box of each element at scale 1 (points). `small`: may stand closer to the path. */
export const ELEMENT_SIZE: Record<JourneyElementKind, { w: number; h: number; small?: boolean }> = {
  bush: { w: 56, h: 42 },
  smallStone: { w: 28, h: 16, small: true },
  flower: { w: 14, h: 24, small: true },
  signpost: { w: 66, h: 88 },
  bamboo: { w: 54, h: 112 },
  dummy: { w: 46, h: 82 },
  carvedRock: { w: 76, h: 58 },
  dryGrass: { w: 30, h: 22, small: true },
  lantern: { w: 38, h: 80 },
  cairn: { w: 32, h: 46 },
  bigRock: { w: 78, h: 52 },
  pointyRock: { w: 50, h: 66 },
  dryBush: { w: 48, h: 40 },
};

type Shape = (rock: Tone) => ReactNode;

/** A small fighter (kicking), used on the signpost and carved in the rock. */
const fighter = (color: string, x: number, y: number) => (
  <G transform={`translate(${x} ${y})`}>
    <Circle cx={-1} cy={-16} r={4.5} fill={color} />
    <Path
      d="M-1 -11 L1 0 M1 0 L15 -6 M1 0 L-4 10 M0 -8 L9 -12 M0 -8 L-8 -4"
      stroke={color}
      strokeWidth={4.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </G>
);

const SHAPES: Record<JourneyElementKind, Shape> = {
  bush: () => (
    <>
      <Ellipse cx={0} cy={-12} rx={27} ry={12} fill={C.bush.shadow} />
      <Circle cx={-13} cy={-15} r={14} fill={C.bush.shadow} />
      <Circle cx={12} cy={-17} r={14} fill={C.bush.shadow} />
      <Circle cx={-13} cy={-19} r={14} fill={C.bush.base} />
      <Circle cx={12} cy={-21} r={14} fill={C.bush.base} />
      <Circle cx={0} cy={-28} r={14} fill={C.bush.base} />
      <Circle cx={-6} cy={-34} r={4} fill={C.bush.light} />
    </>
  ),
  smallStone: (rock) => (
    <>
      <Ellipse cx={0} cy={-7} rx={14} ry={7} fill={rock.shadow} />
      <Ellipse cx={-1} cy={-9} rx={12} ry={6.5} fill={rock.base} />
      <Ellipse cx={-5} cy={-11} rx={3} ry={1.6} fill={rock.light} />
    </>
  ),
  flower: () => (
    <>
      <Rect x={-1.2} y={-15} width={2.4} height={15} rx={1.2} fill={C.flower.stem} />
      <Ellipse cx={3.5} cy={-6} rx={3.5} ry={1.8} fill={C.flower.stem} />
      <Circle cx={0} cy={-17} r={6.4} fill={C.flower.petalShadow} />
      {[0, 72, 144, 216, 288].map((a) => (
        <Circle
          key={a}
          cx={3.6 * Math.sin((a * Math.PI) / 180)}
          cy={-18.5 - 3.6 * Math.cos((a * Math.PI) / 180)}
          r={3.3}
          fill={C.flower.petal}
        />
      ))}
      <Circle cx={0} cy={-18.5} r={2.6} fill={C.flower.center} />
    </>
  ),
  signpost: () => (
    <>
      <Rect x={-4} y={-62} width={8} height={62} rx={3} fill={C.wood.base} />
      <Rect x={0} y={-62} width={4} height={62} rx={2} fill={C.wood.shadow} />
      <Rect x={-33} y={-88} width={66} height={40} rx={8} fill={C.wood.shadow} />
      <Rect x={-33} y={-88} width={66} height={34} rx={8} fill={C.wood.base} />
      <Circle cx={-25} cy={-81} r={2.5} fill={C.wood.light} />
      {fighter(C.fighter, -3, -64)}
    </>
  ),
  // TODO(motion): bamboo swaying softly.
  bamboo: () => (
    <>
      {[
        { x: -15, h: 94 },
        { x: 0, h: 110 },
        { x: 15, h: 82 },
      ].map(({ x, h }) => (
        <G key={x}>
          <Rect x={x - 4} y={-h} width={8} height={h} rx={4} fill={C.bamboo.base} />
          <Rect x={x} y={-h} width={4} height={h} rx={2} fill={C.bamboo.shadow} />
          {Array.from({ length: Math.floor(h / 22) }, (_, i) => (
            <Rect key={i} x={x - 4} y={-h + 18 + i * 22} width={8} height={2.5} rx={1.2} fill={C.bamboo.shadow} />
          ))}
          <Ellipse cx={x - 9} cy={-h + 10} rx={9} ry={3} fill={C.bamboo.leaf} transform={`rotate(-28 ${x - 9} ${-h + 10})`} />
          <Ellipse cx={x + 9} cy={-h + 22} rx={9} ry={3} fill={C.bamboo.leaf} transform={`rotate(24 ${x + 9} ${-h + 22})`} />
        </G>
      ))}
    </>
  ),
  dummy: () => (
    <>
      <Ellipse cx={0} cy={-3} rx={15} ry={3} fill={C.wood.shadow} />
      <Rect x={-22} y={-60} width={18} height={5} rx={2.5} fill={C.wood.shadow} />
      <Rect x={4} y={-52} width={18} height={5} rx={2.5} fill={C.wood.shadow} />
      <Rect x={4} y={-26} width={16} height={5} rx={2.5} fill={C.wood.shadow} />
      <Rect x={-7} y={-80} width={14} height={78} rx={7} fill={C.wood.base} />
      <Rect x={1} y={-78} width={6} height={74} rx={3} fill={C.wood.shadow} />
      <Circle cx={-2.5} cy={-73} r={2} fill={C.wood.light} />
    </>
  ),
  carvedRock: (rock) => (
    <>
      <Path d="M-37 0 C-39 -30 -24 -57 2 -57 C26 -57 39 -34 38 0 Z" fill={rock.shadow} />
      <Path d="M-37 -3 C-39 -30 -24 -57 0 -57 C19 -57 30 -36 27 -3 Z" fill={rock.base} />
      <Ellipse cx={-21} cy={-41} rx={4} ry={2.5} fill={rock.light} />
      {fighter(rock.shadow, -4, -22)}
    </>
  ),
  dryGrass: () => (
    <>
      <Path d="M-8 0 Q-13 -10 -15 -19 Q-6 -11 -3 0 Z" fill={C.dryGrass.shadow} />
      <Path d="M4 0 Q11 -9 15 -17 Q12 -7 9 0 Z" fill={C.dryGrass.shadow} />
      <Path d="M-6 0 Q-6 -12 -8 -21 Q-1 -12 0 0 Z" fill={C.dryGrass.base} />
      <Path d="M-2 0 Q2 -12 5 -22 Q6 -11 4 0 Z" fill={C.dryGrass.base} />
    </>
  ),
  // TODO(motion): lantern light flickering.
  lantern: () => (
    <>
      <Rect x={-14} y={-8} width={28} height={8} rx={3} fill={C.lantern.shadow} />
      <Rect x={-5} y={-42} width={10} height={36} rx={3} fill={C.lantern.base} />
      <Rect x={0} y={-42} width={5} height={36} rx={2} fill={C.lantern.shadow} />
      <Rect x={-13} y={-48} width={26} height={7} rx={3} fill={C.lantern.base} />
      <Rect x={-10} y={-66} width={20} height={19} rx={3} fill={C.lantern.base} />
      <Rect x={-6} y={-62} width={12} height={11} rx={2} fill={C.lanternLight} />
      <Path d="M-19 -64 Q0 -68 19 -64 Q14 -71 10 -74 L-10 -74 Q-14 -71 -19 -64 Z" fill={C.lantern.shadow} />
      <Circle cx={0} cy={-77} r={4} fill={C.lantern.shadow} />
    </>
  ),
  cairn: (rock) => (
    <>
      {[
        { cx: 0, cy: -7, rx: 15, ry: 7 },
        { cx: 1, cy: -19, rx: 11, ry: 6 },
        { cx: -1, cy: -30, rx: 8, ry: 5 },
        { cx: 0, cy: -39, rx: 5, ry: 3.5 },
      ].map((s) => (
        <G key={s.cy}>
          <Ellipse cx={s.cx} cy={s.cy + 1.5} rx={s.rx} ry={s.ry} fill={rock.shadow} />
          <Ellipse cx={s.cx - 1} cy={s.cy - 0.5} rx={s.rx - 1.5} ry={s.ry - 1} fill={rock.base} />
        </G>
      ))}
      <Ellipse cx={-2} cy={-41} rx={1.8} ry={1} fill={rock.light} />
    </>
  ),
  bigRock: (rock) => (
    <>
      <Path d="M-39 0 C-39 -28 -20 -51 4 -51 C28 -51 40 -30 38 0 Z" fill={rock.shadow} />
      <Path d="M-39 -3 C-39 -28 -20 -51 2 -51 C20 -51 29 -31 23 -3 Z" fill={rock.base} />
      <Ellipse cx={-19} cy={-36} rx={5} ry={3} fill={rock.light} />
    </>
  ),
  pointyRock: (rock) => (
    <>
      <Path d="M-25 0 L-6 -60 Q0 -68 6 -60 L25 0 Z" fill={rock.shadow} />
      <Path d="M-25 0 L-6 -60 Q-1 -66 2 -60 L7 0 Z" fill={rock.base} />
      <Ellipse cx={-8} cy={-42} rx={2} ry={4} fill={rock.light} />
    </>
  ),
  dryBush: () => (
    <>
      <Path
        d="M0 0 L-14 -26 M0 0 L2 -34 M0 0 L16 -24 M-7 -13 L-20 -16 M8 -12 L20 -12"
        stroke={C.dryBush.shadow}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      {[
        [-14, -26],
        [2, -34],
        [16, -24],
        [-20, -16],
        [20, -12],
      ].map(([x, y]) => (
        <Circle key={`${x}`} cx={x} cy={y} r={4.5} fill={C.dryBush.base} />
      ))}
    </>
  ),
};

export interface PlacedElement {
  kind: JourneyElementKind;
  /** Bottom center, in the section's coordinates. */
  x: number;
  y: number;
  scale: number;
  flip: boolean;
}

/** One element at its place (inside an Svg). */
export function JourneyElement({ element, rock }: { element: PlacedElement; rock: Tone }) {
  const { x, y, scale, flip, kind } = element;
  return <G transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>{SHAPES[kind](rock)}</G>;
}
