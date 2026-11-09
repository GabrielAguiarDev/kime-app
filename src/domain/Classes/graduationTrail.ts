import type { ModalityBelt } from './classesTypes';

/**
 * Graduation trail (journey) of one modality with belts. Each belt of the
 * sequence is a SECTION, in the registered order. The count restarts in each
 * belt: the current section counts the confirmed classes in the modality since
 * the last graduation, up to the classes the NEXT belt requires. The last belt
 * is a final section with a single "Faixa máxima" node.
 *
 * Before the first belt (student without one, first belt asking for classes)
 * there is an opening section toward the first belt.
 */

/** Most stops a section is split into; the classes are divided equally. */
export const TRAIL_MAX_STOPS = 10;

/** Scenery of a section (trail/journeyTheme): 1 prado · 2 bambus · 3 terra/entardecer · 4 rochas/lanternas · 5 montanhas escuras. */
export type TrailEnvironment = 1 | 2 | 3 | 4 | 5;

export type TrailSectionState = 'done' | 'current' | 'future';

/**
 * done / current / future; `ready` = graduation node with every stop done
 * (the belt only changes when the teacher records the graduation).
 */
export type TrailStopState = 'done' | 'current' | 'future' | 'ready';

/** Text group of a stop (trailTexts): start, middle, near the graduation, graduation. */
export type TrailStopKind = 'start' | 'middle' | 'near' | 'graduation';

export interface TrailStop {
  /** Position in the section (0-based). */
  index: number;
  /** 1-based class numbers covered (since the last graduation). */
  from: number;
  to: number;
  state: TrailStopState;
  /** Classes done inside this stop. */
  doneInStop: number;
  /** The last stop of a section: graduation to the next belt. */
  isGraduation: boolean;
  kind: TrailStopKind;
}

export interface TrailSection {
  /** Stable key: the belt id, or `start` for the opening section. */
  key: string;
  /** 1-based number shown in the banner ("Seção 2"); 0 for the opening section. */
  number: number;
  /** Belt the section is about; null in the opening section (no belt yet). */
  belt: ModalityBelt | null;
  /** Belt the graduation node leads to; null in the final section. */
  next: ModalityBelt | null;
  state: TrailSectionState;
  environment: TrailEnvironment;
  /** Classes the next belt requires; 0 when not defined (or final section). */
  required: number;
  /** Classes done in the section, capped at `required`. */
  done: number;
  /** Final section ("Faixa máxima"): no stops, a single node. */
  isFinal: boolean;
  /** Empty in the final section and when the next belt has no goal yet. */
  stops: TrailStop[];
}

export interface GraduationTrail {
  sections: TrailSection[];
  /** Index of the section the student is in. */
  currentSection: number;
  /** Index of the current stop inside it; null when the section has none. */
  currentStop: number | null;
}

/** Stop sizes for `required` classes: at most 10 stops, the last one takes the rest. */
export function stopSizes(required: number, maxStops = TRAIL_MAX_STOPS): number[] {
  if (required <= 0) return [];
  const count = Math.min(maxStops, required);
  const size = Math.floor(required / count);
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? required - size * (count - 1) : size));
}

function stopKind(index: number, count: number): TrailStopKind {
  if (index === count - 1) return 'graduation';
  if (index === 0) return 'start';
  if (index >= count - 3) return 'near';
  return 'middle';
}

/** Stops of a section; `sectionState` decides everything outside the current one. */
export function sectionStops(required: number, done: number, sectionState: TrailSectionState): TrailStop[] {
  const sizes = stopSizes(required);
  let from = 1;
  return sizes.map((size, index) => {
    const to = from + size - 1;
    const isGraduation = index === sizes.length - 1;
    let state: TrailStopState;
    let doneInStop: number;
    if (sectionState === 'done') {
      state = 'done';
      doneInStop = size;
    } else if (sectionState === 'future') {
      state = 'future';
      doneInStop = 0;
    } else {
      doneInStop = Math.max(0, Math.min(done - (from - 1), size));
      if (isGraduation && done >= to) state = 'ready';
      else state = done >= to ? 'done' : done >= from - 1 ? 'current' : 'future';
    }
    const stop: TrailStop = { index, from, to, state, doneInStop, isGraduation, kind: stopKind(index, sizes.length) };
    from = to + 1;
    return stop;
  });
}

/**
 * Environment by position in the trail: the first section always 1, the
 * last always 5, the ones in between spread over 2, 3 and 4.
 */
export function beltEnvironment(position: number, count: number): TrailEnvironment {
  if (position <= 0 || count <= 1) return 1;
  if (position >= count - 1) return 5;
  const middle = count - 2;
  return (2 + Math.min(2, Math.floor(((position - 1) * 3) / middle))) as TrailEnvironment;
}

/**
 * Builds the trail. `currentBeltId` is the student's belt in the modality
 * (null = none yet), `sinceBelt` the confirmed classes since the last
 * graduation in it (all of them before the first belt).
 */
export function graduationTrail(
  modalityBelts: ModalityBelt[],
  currentBeltId: string | null,
  sinceBelt: number,
): GraduationTrail {
  const belts = [...modalityBelts].sort((a, b) => a.position - b.position);
  if (belts.length === 0) return { sections: [], currentSection: 0, currentStop: null };

  const found = currentBeltId ? belts.findIndex((b) => b.id === currentBeltId) : -1;
  const sections: TrailSection[] = [];
  const firstRequired = belts[0]!.classesRequired ?? 0;

  // Opening section toward the first belt, only when the first belt asks for
  // classes. Shown to everyone (done for students that already have a belt).
  const hasOpening = firstRequired > 0;
  // Index in `sections` the student is in.
  const current = found >= 0 ? found + (hasOpening ? 1 : 0) : 0;

  const sectionState = (i: number): TrailSectionState => (i < current ? 'done' : i === current ? 'current' : 'future');

  if (hasOpening) {
    const state = sectionState(0);
    const done = state === 'current' ? Math.min(sinceBelt, firstRequired) : state === 'done' ? firstRequired : 0;
    sections.push({
      key: 'start',
      number: 0,
      belt: null,
      next: belts[0]!,
      state,
      environment: 1,
      required: firstRequired,
      done,
      isFinal: false,
      stops: sectionStops(firstRequired, done, state),
    });
  }

  belts.forEach((belt, position) => {
    const i = sections.length;
    const state = sectionState(i);
    const next = belts[position + 1] ?? null;
    const required = next?.classesRequired ?? 0;
    const done = state === 'current' ? Math.min(sinceBelt, required) : state === 'done' ? required : 0;
    sections.push({
      key: belt.id,
      number: position + 1,
      belt,
      next,
      state,
      environment: 1,
      required,
      done,
      isFinal: !next,
      stops: next ? sectionStops(required, done, state) : [],
    });
  });

  // Environments follow the position in the whole trail (opening section
  // included): the first section is always 1, the last always 5.
  sections.forEach((section, i) => {
    section.environment = beltEnvironment(i, sections.length);
  });

  // A student without a belt in a sequence whose first belt needs no classes
  // is treated as starting in the first section.
  const currentSection = Math.min(current, sections.length - 1);
  const stops = sections[currentSection]!.stops;
  const at = stops.findIndex((s) => s.state === 'current' || s.state === 'ready');
  return { sections, currentSection, currentStop: at >= 0 ? at : null };
}
