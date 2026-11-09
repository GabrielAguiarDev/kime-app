import type { TrailEnvironment } from '@domain/Classes';

import { ELEMENT_SIZE, type JourneyElementKind, type PlacedElement } from './JourneyElements';
import { NODE_SIZE, NODE_SIZE_CURRENT } from './JourneyNode';
import { JOURNEY_NODE_SPACING } from './journeyTheme';

/**
 * Geometry of the vector Jornada (drawn at the screen width, no zoom). From
 * the bottom up: the start (meadow, signpost), one SECTION per belt (Seção 1
 * at the bottom), the top (sky, mountains, dojo). Each block's ground rises
 * WAVE points above its top in an organic hill line, over the block above (no
 * gradient). The nodes and banners are drawn in a layer over all the scenery.
 *
 * The path is one continuous line from the bottom edge of the content to the
 * dojo door: straight up from the bottom to the first node, a zigzag between
 * consecutive nodes (one bump per gap, sides alternating, vertical at every
 * node center), straight from the last node to the dojo.
 *
 * Everything is deterministic (seeded by the section key): the scenery never
 * changes between openings.
 */

/** Height of a section = distance between two node centers (journeyTheme). */
export const SECTION_HEIGHT = JOURNEY_NODE_SPACING;
/** The node center inside its section (from its top). */
export const NODE_Y = 60;
/** Height of the start (below Seção 1) and of the top (dojo). */
export const START_HEIGHT = 320;
export const TOP_HEIGHT = 560;
/** How far a block's ground rises over the block above. */
export const WAVE = 26;
/** Path width and zigzag swing (fractions of the screen width; the swing follows the node spacing). */
const PATH_WIDTH = 0.14;
const PATH_SWING = (0.11 * JOURNEY_NODE_SPACING) / 170;

/** Banner under the node (JourneySection): max width, overlap with the node, room it may take (font scale 130%). */
export const BANNER_MAX_WIDTH = 300;
export const NODE_OVER_BANNER = 6;
const BANNER_ROOM = 96;
/** Mascot next to the current node (tokens.size.mascotEmpty) and its gap to the node. */
export const MASCOT = 96;
export const MASCOT_GAP = 4;

/** Elements keep this far from the screen sides and from each other / the node and banner. */
const EDGE = 8;
const GAP = 6;
/** Top of the room for elements in a section (the banner above may hang a little into it). */
const SECTION_TOP = 24;

export const pathWidth = (width: number) => Math.round(width * PATH_WIDTH);
export const bannerWidth = (width: number, margin: number) => Math.min(BANNER_MAX_WIDTH, width - margin * 2);

/**
 * Center x of the path at height y (may be negative: the hill band over the
 * block above) of section `index` out of `count`.
 */
export function sectionPathX(y: number, width: number, index: number, count: number) {
  const cx = width / 2;
  // Gap k joins the node of section k to the node of section k+1; t from 0 (k) to 1 (k+1).
  const above = y <= NODE_Y;
  const k = above ? index : index - 1;
  const t = above ? (NODE_Y - y) / SECTION_HEIGHT : 1 - (y - NODE_Y) / SECTION_HEIGHT;
  // Straight from the start to the first node and from the last node to the dojo.
  if (k < 0 || k >= count - 1) return cx;
  const swing = width * PATH_SWING * (k % 2 === 0 ? 1 : -1);
  return cx + (swing * (1 - Math.cos(2 * Math.PI * Math.min(1, Math.max(0, t))))) / 2;
}

/** SVG path data of a polyline through the samples of `x(y)` from y0 to y1. */
export function verticalPath(x: (y: number) => number, y0: number, y1: number, steps = 40) {
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const y = y0 + ((y1 - y0) * i) / steps;
    d += `${i === 0 ? 'M' : 'L'}${x(y).toFixed(1)} ${y.toFixed(1)} `;
  }
  return d.trim();
}

// ------------------------------------------------------------- random ---

/** Seed from a string (FNV-1a). */
export function seedOf(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic random in [0, 1) (mulberry32). */
export function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rnd: () => number, min: number, max: number) => min + rnd() * (max - min);

// --------------------------------------------------------------- ground ---

/**
 * Closed ground shape of a block `height` tall whose top edge is an organic
 * hill line between y = -WAVE and y = -WAVE * 0.3 (Catmull-Rom through
 * random points; a crest at the center where the path crosses).
 */
export function groundPath(width: number, height: number, seed: number) {
  const rnd = random(seed);
  const cx = width / 2;
  const points: [number, number][] = [];
  // Points strictly between `from` and `to`.
  const side = (from: number, to: number) => {
    const n = Math.max(2, Math.round((to - from) / 70));
    for (let i = 1; i < n; i++) points.push([from + ((to - from) * i) / n, -WAVE * between(rnd, 0.3, 1)]);
  };
  points.push([-4, -WAVE * between(rnd, 0.3, 1)]);
  side(0, cx);
  points.push([cx, -WAVE]);
  side(cx, width);
  points.push([width + 4, -WAVE * between(rnd, 0.3, 1)]);

  const p = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))]!;
  let d = `M${p(0)[0]} ${p(0)[1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]!.toFixed(1)} ${c1[1]!.toFixed(1)} ${c2[0]!.toFixed(1)} ${c2[1]!.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return `${d} L${width + 4} ${height} L-4 ${height} Z`;
}

export interface Patch {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** Ground patches (manchas) of a block, away from its hill line. */
export function groundPatches(width: number, height: number, seed: number): Patch[] {
  const rnd = random(seed ^ 0x5bd1e995);
  const count = Math.max(2, Math.round(height / 70)) + Math.floor(rnd() * 2);
  return Array.from({ length: count }, () => {
    const rx = between(rnd, 20, 52);
    const ry = between(rnd, 6, 13);
    return { cx: between(rnd, 0, width), cy: between(rnd, ry + 6, height - WAVE - ry - 6), rx, ry };
  });
}

// ------------------------------------------------------------- elements ---

/** Elements of each environment, with weights. */
const POOLS: Record<TrailEnvironment, [JourneyElementKind, number][]> = {
  1: [
    ['bush', 3],
    ['smallStone', 2],
    ['flower', 4],
  ],
  2: [
    ['bamboo', 4],
    ['bush', 2],
    ['smallStone', 2],
  ],
  3: [
    ['dummy', 2],
    ['carvedRock', 2],
    ['dryGrass', 4],
  ],
  4: [
    ['lantern', 3],
    ['cairn', 2],
    ['bigRock', 2],
  ],
  5: [
    ['pointyRock', 3],
    ['dryBush', 3],
    ['bigRock', 2],
  ],
};

/** Small element of each environment, used when a side has room for little else. */
const SMALL: Record<TrailEnvironment, JourneyElementKind> = {
  1: 'flower',
  2: 'smallStone',
  3: 'dryGrass',
  4: 'smallStone',
  5: 'smallStone',
};

export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const boxOf = (e: PlacedElement): Box => {
  const s = ELEMENT_SIZE[e.kind];
  return { x0: e.x - (s.w * e.scale) / 2, x1: e.x + (s.w * e.scale) / 2, y0: e.y - s.h * e.scale, y1: e.y };
};

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 + GAP && b.x0 < a.x1 + GAP && a.y0 < b.y1 + GAP && b.y0 < a.y1 + GAP;

interface PlaceOptions {
  width: number;
  environment: TrailEnvironment;
  seed: number;
  /** Where the bottom of an element may go: between top + its height and bottom. */
  top: number;
  bottom: number;
  /** Center x of the path at y. */
  pathX: (y: number) => number;
  /** Already placed (signpost): kept, avoided. */
  fixed?: PlacedElement[];
  /** Boxes to avoid (node, banner, mascot). */
  avoid?: Box[];
}

/**
 * 2 to 4 elements per side, on the sides of the path, never over the path,
 * the node, the banner or the mascot, always whole on screen (also on small
 * iPhones). Small ones (flowers, pebbles, grass) may stand closer to the
 * path; when a side has room for little else it gets small ones.
 */
export function placeElements({ width, environment, seed, top, bottom, pathX, fixed = [], avoid = [] }: PlaceOptions): PlacedElement[] {
  const rnd = random(seed);
  const pool = POOLS[environment];
  const total = pool.reduce((a, [, w]) => a + w, 0);
  const pick = () => {
    let r = rnd() * total;
    for (const [kind, w] of pool) {
      r -= w;
      if (r < 0) return kind;
    }
    return pool[0]![0];
  };
  const halfPath = pathWidth(width) / 2;
  const placed: PlacedElement[] = [...fixed];
  const blocked: Box[] = [...avoid, ...fixed.map(boxOf)];

  const fits = (e: PlacedElement) => {
    const box = boxOf(e);
    if (box.x0 < EDGE || box.x1 > width - EDGE) return false;
    const clearance = ELEMENT_SIZE[e.kind].small ? 2 : 10;
    for (let k = 0; k <= 6; k++) {
      const px = pathX(box.y0 + ((box.y1 - box.y0) * k) / 6);
      if (box.x0 < px + halfPath + clearance && box.x1 > px - halfPath - clearance) return false;
    }
    return !blocked.some((b) => overlaps(box, b));
  };

  const tryPlace = (kind: JourneyElementKind, left: boolean, attempts: number) => {
    const size = ELEMENT_SIZE[kind];
    const scale = Math.min(between(rnd, 0.85, 1.05), (bottom - top) / size.h);
    if (scale < 0.5) return false;
    const halfW = (size.w * scale) / 2;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const x = left ? between(rnd, EDGE + halfW, width / 2 - halfW) : between(rnd, width / 2 + halfW, width - EDGE - halfW);
      const y = between(rnd, top + size.h * scale, bottom);
      const element: PlacedElement = { kind, x, y, scale, flip: rnd() < 0.5 };
      if (fits(element)) {
        placed.push(element);
        blocked.push(boxOf(element));
        return true;
      }
    }
    return false;
  };

  for (const left of [true, false]) {
    const count = 2 + Math.floor(rnd() * 3);
    let onSide = 0;
    for (let i = 0; i < count; i++) if (tryPlace(pick(), left, 14)) onSide++;
    for (let i = 0; onSide < 2 && i < 3; i++) if (tryPlace(SMALL[environment], left, 20)) onSide++;
  }
  // Lower elements are drawn over the ones behind them.
  return placed.sort((a, b) => a.y - b.y);
}

/** Node, banner and (current) mascot of a section, in its coordinates. */
export function sectionReserved(width: number, margin: number, current: boolean): Box[] {
  const cx = width / 2;
  const size = current ? NODE_SIZE_CURRENT : NODE_SIZE;
  const bw = bannerWidth(width, margin);
  const boxes: Box[] = [
    { x0: cx - size / 2, x1: cx + size / 2, y0: NODE_Y - size / 2, y1: NODE_Y + size / 2 },
    { x0: (width - bw) / 2, x1: (width + bw) / 2, y0: NODE_Y + size / 2 - NODE_OVER_BANNER, y1: NODE_Y + size / 2 + BANNER_ROOM },
  ];
  if (current) {
    const x0 = cx + size / 2 + MASCOT_GAP;
    boxes.push({ x0, x1: x0 + MASCOT, y0: NODE_Y - MASCOT / 2, y1: NODE_Y + MASCOT / 2 });
  }
  return boxes;
}

interface SectionElementsOptions {
  width: number;
  margin: number;
  environment: TrailEnvironment;
  index: number;
  count: number;
  key: string;
  current: boolean;
}

/** Elements of a section, beside the node and the banner. */
export function sectionElements({ width, margin, environment, index, count, key, current }: SectionElementsOptions) {
  return placeElements({
    width,
    environment,
    seed: seedOf(`section:${key}`),
    top: SECTION_TOP,
    // Above the hill line of the section below.
    bottom: SECTION_HEIGHT - WAVE - 6,
    pathX: (y) => sectionPathX(y, width, index, count),
    avoid: sectionReserved(width, margin, current),
  });
}

/** Elements of the start: the signpost on the left of the path, near the middle, plus meadow elements. */
export function startElements(width: number) {
  const sign = ELEMENT_SIZE.signpost;
  const signpost: PlacedElement = {
    kind: 'signpost',
    x: Math.max(EDGE + sign.w / 2, width / 2 - pathWidth(width) / 2 - 14 - sign.w / 2),
    y: START_HEIGHT / 2 + sign.h / 2,
    scale: 1,
    flip: false,
  };
  return placeElements({
    width,
    environment: 1,
    seed: seedOf('start'),
    top: SECTION_TOP,
    bottom: START_HEIGHT - 16,
    pathX: () => width / 2,
    fixed: [signpost],
  });
}
