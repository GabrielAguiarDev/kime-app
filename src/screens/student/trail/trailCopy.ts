import { beltName, type TrailSection, type TrailStopKind } from '@domain/Classes';
import { countOf } from '@utils/plural';

import { TRAIL_FINAL_TEXT, trailText } from './trailTexts';

/** Every class of the section done, waiting for the teacher to record the graduation. */
export const isReady = (section: TrailSection) =>
  section.state === 'current' && !section.isFinal && section.required > 0 && section.done >= section.required;

/** "Seção 1 · Fundamentos" (no belt yet) / "Seção 2 · Faixa branca"; numbered by position in the trail. */
export function sectionTitle(section: TrailSection, index: number): string {
  const name = section.belt ? `Faixa ${beltName(section.belt).toLowerCase()}` : 'Fundamentos';
  return `Seção ${index + 1} · ${name}`;
}

/** Banner caption: "3 de 6 aulas" (count restarts in each belt). */
export function sectionCount(section: TrailSection, modalityTotal: number): string {
  if (section.isFinal) return section.state === 'future' ? 'Faixa máxima' : `Faixa máxima · ${countOf(modalityTotal, 'aula', 'aulas')}`;
  if (section.required <= 0) return 'Aulas não definidas';
  return `${section.done} de ${countOf(section.required, 'aula', 'aulas')}`;
}

export interface NodeCopy {
  title: string;
  status: string;
  text: string;
}

function textKind(section: TrailSection): TrailStopKind {
  if (section.state === 'done' || isReady(section)) return 'graduation';
  if (section.state === 'future' || section.done === 0) return 'start';
  return section.required - section.done <= Math.max(1, Math.ceil(section.required * 0.25)) ? 'near' : 'middle';
}

/** Popover of a section's node: title, status and a short text. */
export function nodeCopy(section: TrailSection, index: number, modalityTotal: number): NodeCopy {
  const title = sectionTitle(section, index);
  let status: string;
  if (section.state === 'future') status = 'Bloqueada';
  else if (section.state === 'done') status = 'Concluída';
  else if (section.isFinal) status = countOf(modalityTotal, 'aula', 'aulas');
  else if (section.required <= 0) status = 'A academia ainda não definiu as aulas';
  else if (isReady(section)) status = 'Pronto para graduar';
  else status = `${section.done} de ${countOf(section.required, 'aula', 'aulas')}`;

  const text = section.isFinal && section.state !== 'future' ? TRAIL_FINAL_TEXT : trailText(section.environment, textKind(section), index, 0);
  return { title, status, text };
}
