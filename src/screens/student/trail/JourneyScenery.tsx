import { memo, useMemo } from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import type { TrailEnvironment } from '@domain/Classes';
import { useAppTheme } from '@theme';

import { JourneyElement, type PlacedElement } from './JourneyElements';
import {
  SECTION_HEIGHT,
  START_HEIGHT,
  TOP_HEIGHT,
  WAVE,
  groundPatches,
  groundPath,
  pathWidth,
  sectionElements,
  sectionPathX,
  seedOf,
  startElements,
  verticalPath,
} from './journeyLayout';
import { JOURNEY_COLORS as C, JOURNEY_ENV_COLORS, type Tone } from './journeyTheme';

interface BlockProps {
  width: number;
  height: number;
  ground: string;
  patch: string;
  path: Tone;
  rock: Tone;
  seed: number;
  /** Path data from its top (-WAVE, under the hill line of this block) down. */
  pathD: string;
  cap: 'butt' | 'round';
  elements: PlacedElement[];
}

/**
 * One block of ground (section or start): full width, its hill line rising
 * WAVE points over the block above (the Svg hangs above the cell), patches,
 * the path (shadow tone on the right, base on the left) and the elements.
 */
function GroundBlock({ width, height, ground, patch, path, rock, seed, pathD, cap, elements }: BlockProps) {
  const patches = useMemo(() => groundPatches(width, height, seed), [width, height, seed]);
  const pw = pathWidth(width);
  return (
    <Svg width={width} height={height + WAVE} style={{ position: 'absolute', top: -WAVE, left: 0 }} accessible={false} pointerEvents="none">
      <G transform={`translate(0 ${WAVE})`}>
        <Path d={groundPath(width, height, seed)} fill={ground} />
        {patches.map((p, i) => (
          <Ellipse key={i} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} fill={patch} />
        ))}
        <Path d={pathD} stroke={path.shadow} strokeWidth={pw} strokeLinecap={cap} fill="none" />
        <Path
          d={pathD}
          stroke={path.base}
          strokeWidth={pw * 0.78}
          strokeLinecap={cap}
          fill="none"
          transform={`translate(${-pw * 0.08} 0)`}
        />
        {elements.map((e, i) => (
          <JourneyElement key={i} element={e} rock={rock} />
        ))}
      </G>
    </Svg>
  );
}

/** Scenery of a section: ground of its environment, path through the node, elements on the sides. */
export const SectionScenery = memo(function SectionScenery({
  width,
  environment,
  sectionIndex,
  sectionCount,
  sectionKey,
  current,
}: {
  width: number;
  environment: TrailEnvironment;
  sectionIndex: number;
  sectionCount: number;
  sectionKey: string;
  /** The current section (the mascot stands beside its node). */
  current: boolean;
}) {
  const { spacing } = useAppTheme();
  const colors = JOURNEY_ENV_COLORS[environment];
  const elements = useMemo(
    () =>
      sectionElements({
        width,
        margin: spacing.screenMargin,
        environment,
        index: sectionIndex,
        count: sectionCount,
        key: sectionKey,
        current,
      }),
    [width, spacing.screenMargin, environment, sectionIndex, sectionCount, sectionKey, current],
  );
  const pathD = useMemo(
    () => verticalPath((y) => sectionPathX(y, width, sectionIndex, sectionCount), -WAVE, SECTION_HEIGHT),
    [width, sectionIndex, sectionCount],
  );
  return (
    <GroundBlock
      width={width}
      height={SECTION_HEIGHT}
      ground={colors.ground}
      patch={colors.patch}
      path={colors.path}
      rock={colors.rock}
      seed={seedOf(`ground:${sectionKey}`)}
      pathD={pathD}
      cap="butt"
      elements={elements}
    />
  );
});

/** The start of the trail (below Seção 1): meadow, the path coming from the bottom edge, the signpost. */
export const StartScenery = memo(function StartScenery({ width }: { width: number }) {
  const colors = JOURNEY_ENV_COLORS[1];
  const elements = useMemo(() => startElements(width), [width]);
  return (
    <GroundBlock
      width={width}
      height={START_HEIGHT}
      ground={colors.ground}
      patch={colors.patch}
      path={colors.path}
      rock={colors.rock}
      seed={seedOf('ground:start')}
      pathD={verticalPath(() => width / 2, -WAVE, START_HEIGHT, 1)}
      cap="butt"
      elements={elements}
    />
  );
});

const cloud = (x: number, y: number, s: number) => (
  <G transform={`translate(${x} ${y}) scale(${s})`}>
    <Circle cx={-28} cy={0} r={18} fill={C.cloud} />
    <Circle cx={-6} cy={-10} r={24} fill={C.cloud} />
    <Circle cx={20} cy={-3} r={18} fill={C.cloud} />
    <Circle cx={36} cy={5} r={12} fill={C.cloud} />
    <Rect x={-44} y={0} width={92} height={17} rx={8.5} fill={C.cloud} />
  </G>
);

/**
 * The top (destination): stormy purple sky with clouds, a static lightning
 * bolt, mountain silhouettes, the hill and the dojo where the path ends. Drawn
 * anchored at the bottom; a taller `height` (short trail) only adds sky.
 */
export const TopScenery = memo(function TopScenery({ width, height }: { width: number; height: number }) {
  const cx = width / 2;
  const w = width;
  // Ground line of the dojo.
  const yb = TOP_HEIGHT - 150;
  const pw = pathWidth(width);
  const d = C.dojo;
  const pole = Math.min(122, cx - 20);
  const banner = (px: number) => (
    <G key={px}>
      <Rect x={px - 2} y={yb - 166} width={4} height={166} rx={2} fill={d.pole} />
      <Rect x={px - 15} y={yb - 160} width={30} height={5} rx={2.5} fill={d.pole} />
      <Path d={`M${px - 12} ${yb - 155} L${px + 12} ${yb - 155} L${px + 12} ${yb - 78} L${px} ${yb - 88} L${px - 12} ${yb - 78} Z`} fill={d.banner.shadow} />
      <Path d={`M${px - 12} ${yb - 155} L${px + 5} ${yb - 155} L${px + 5} ${yb - 84} L${px} ${yb - 88} L${px - 12} ${yb - 78} Z`} fill={d.banner.base} />
    </G>
  );
  // A dark roof with curved eaves: shadow under, base over it.
  const roof = (half: number, top: number, bottom: number, inset: number) => {
    const shape = (dy: number) =>
      `M${cx - half} ${bottom + dy} Q${cx - half + 22} ${bottom - 4 + dy} ${cx - half + inset} ${top + dy} L${cx + half - inset} ${top + dy} Q${cx + half - 22} ${bottom - 4 + dy} ${cx + half} ${bottom + dy} Z`;
    return (
      <>
        <Path d={shape(4)} fill={d.roof.shadow} />
        <Path d={shape(0)} fill={d.roof.base} />
      </>
    );
  };

  return (
    <Svg width={width} height={height} accessible={false} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height} fill={C.sky} />
      <G transform={`translate(0 ${height - TOP_HEIGHT})`}>
        {cloud(w * 0.2, 96, 1)}
        {cloud(w * 0.58, 44, 0.8)}
        {cloud(w * 0.82, 106, 1.1)}
        {/* TODO(motion): lightning flashing. It ends above the banner on the right. */}
        <Path
          d={`M${w * 0.8} 118 L${w * 0.8 - 18} 170 L${w * 0.8 - 6} 170 L${w * 0.8 - 22} 232 L${w * 0.8 + 10} 158 L${w * 0.8 - 2} 158 L${w * 0.8 + 12} 118 Z`}
          fill={C.lightning}
        />
        <Path
          d={`M-4 ${yb + 40} L-4 ${yb - 70} Q${w * 0.1} ${yb - 150} ${w * 0.2} ${yb - 112} Q${w * 0.3} ${yb - 78} ${w * 0.38} ${yb - 118} Q${w * 0.5} ${yb - 196} ${w * 0.62} ${yb - 128} Q${w * 0.72} ${yb - 86} ${w * 0.8} ${yb - 136} Q${w * 0.9} ${yb - 176} ${w + 4} ${yb - 92} L${w + 4} ${yb + 40} Z`}
          fill={C.mountain}
        />
        <Path
          d={`M-4 ${yb + 34} C${w * 0.22} ${yb + 14} ${w * 0.3} ${yb - 10} ${cx} ${yb - 10} C${w * 0.7} ${yb - 10} ${w * 0.78} ${yb + 14} ${w + 4} ${yb + 34} L${w + 4} ${TOP_HEIGHT} L-4 ${TOP_HEIGHT} Z`}
          fill={C.summit.ground}
        />
        <Ellipse cx={w * 0.16} cy={yb + 70} rx={44} ry={11} fill={C.summit.patch} />
        <Ellipse cx={w * 0.84} cy={yb + 104} rx={36} ry={9} fill={C.summit.patch} />

        {/* Dojo base, then the path up to the door. */}
        <Rect x={cx - 92} y={yb - 12} width={184} height={12} rx={4} fill={d.stone.shadow} />
        <Rect x={cx - 92} y={yb - 12} width={150} height={8} rx={4} fill={d.stone.base} />
        <Path d={`M${cx} ${TOP_HEIGHT} L${cx} ${yb - 12}`} stroke={JOURNEY_ENV_COLORS[5].path.shadow} strokeWidth={pw} fill="none" />
        <Path
          d={`M${cx} ${TOP_HEIGHT} L${cx} ${yb - 12}`}
          stroke={JOURNEY_ENV_COLORS[5].path.base}
          strokeWidth={pw * 0.78}
          fill="none"
          transform={`translate(${-pw * 0.08} 0)`}
        />

        {banner(cx - pole)}
        {banner(cx + pole)}

        {/* Dojo */}
        <Rect x={cx - 78} y={yb - 84} width={156} height={72} fill={d.wall.base} />
        <Rect x={cx + 44} y={yb - 84} width={34} height={72} fill={d.wall.shadow} />
        <Rect x={cx - 78} y={yb - 84} width={156} height={9} fill={d.wall.shadow} />
        <Rect x={cx - 62} y={yb - 64} width={26} height={20} rx={3} fill={d.window} />
        <Rect x={cx + 36} y={yb - 64} width={26} height={20} rx={3} fill={d.window} />
        <Rect x={cx - 17} y={yb - 52} width={34} height={40} rx={3} fill={d.door} />
        {roof(106, yb - 100, yb - 80, 34)}
        <Rect x={cx - 46} y={yb - 132} width={92} height={34} fill={d.wall.base} />
        <Rect x={cx + 24} y={yb - 132} width={22} height={34} fill={d.wall.shadow} />
        <Rect x={cx - 14} y={yb - 124} width={28} height={16} rx={3} fill={d.window} />
        {roof(76, yb - 148, yb - 128, 30)}
        <Rect x={cx - 38} y={yb - 155} width={76} height={8} rx={4} fill={d.roof.base} />
        <Circle cx={cx - 26} cy={yb - 141} r={2.5} fill={d.roof.light} />
      </G>
    </Svg>
  );
});
