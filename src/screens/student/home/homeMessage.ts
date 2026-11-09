import { missing } from '@utils/plural';

/**
 * Message of the mascot balloon at the end of Início: one at a time, by
 * priority. Pure, so the order is tested.
 */
export interface HomeMessageInput {
  /** A check-in of today (selected modality) waits for the professor. */
  pendingCheckin: boolean;
  /** Weeks in the training streak; at risk when this week has no confirmed class yet. */
  trainingStreak: { current: number; currentDone: boolean } | null;
  /** Days in the water streak; at risk when today's goal is not met yet. */
  waterStreak: { current: number; currentDone: boolean } | null;
  /** Water of today (null goal = unknown). */
  water: { totalMl: number; goalMl: number | null; isLimit: boolean } | null;
  /** Academy-local time `HH:MM`. */
  nowTime: string;
  /** Classes left to the next belt (null = no next belt). */
  belt: { left: number; name: string } | null;
  /** Days to the nearest championship of the modality (null = none). */
  championship: { days: number; name: string } | null;
  /** Day of the year, to rotate the general tips. */
  dayOfYear: number;
}

/** Water counts as late from 17:00 on, under this share of the goal. */
export const LATE_WATER_TIME = '17:00';
export const LATE_WATER_SHARE = 0.6;
/** A belt is "close" with at most this many classes left. */
export const BELT_CLOSE = 3;
/** A championship is "coming" within this many days. */
export const CHAMPIONSHIP_SOON_DAYS = 14;

export const TIPS = [
  'Chegue alguns minutos antes para aquecer com calma.',
  'Beba água antes, durante e depois do treino.',
  'Dormir bem também é treino: o corpo se recupera à noite.',
  'Constância vence intensidade. Uma aula a mais por semana faz diferença.',
  'Alongue depois do treino para voltar mais leve na próxima aula.',
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function homeMessage(i: HomeMessageInput): string {
  if (i.pendingCheckin) return 'Check-in enviado. Aguardando o professor.';
  if (i.trainingStreak && i.trainingStreak.current > 0 && !i.trainingStreak.currentDone) {
    return `Treine até domingo para manter sua disciplina de ${plural(i.trainingStreak.current, 'semana', 'semanas')}.`;
  }
  if (i.water && i.water.goalMl && !i.water.isLimit && i.nowTime >= LATE_WATER_TIME) {
    const left = i.water.goalMl - i.water.totalMl;
    if (i.water.totalMl < i.water.goalMl * LATE_WATER_SHARE && left > 0) {
      return `Faltam ${left.toLocaleString('pt-BR')} ml para a sua meta de hoje.`;
    }
  }
  if (i.waterStreak && i.waterStreak.current > 0 && !i.waterStreak.currentDone && i.nowTime >= LATE_WATER_TIME) {
    return `Cumpra a água de hoje para manter sua disciplina de ${plural(i.waterStreak.current, 'dia', 'dias')}.`;
  }
  if (i.belt && i.belt.left > 0 && i.belt.left <= BELT_CLOSE) {
    return `${missing(i.belt.left, 'aula', 'aulas')} para a faixa ${i.belt.name}.`;
  }
  if (i.championship && i.championship.days >= 0 && i.championship.days <= CHAMPIONSHIP_SOON_DAYS) {
    return i.championship.days === 0
      ? `Hoje é dia de ${i.championship.name}. Boa sorte à equipe!`
      : `${missing(i.championship.days, 'dia', 'dias')} para o ${i.championship.name}.`;
  }
  return TIPS[i.dayOfYear % TIPS.length]!;
}
