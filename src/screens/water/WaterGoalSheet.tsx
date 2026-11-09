import { FeedbackSheet } from '@components';

import { formatMl } from './format';

/**
 * "Meta do dia batida." / "Limite do dia cumprido." (Início and Água). The
 * water streak grows on this same moment, so this sheet carries it: the
 * `streak` pose and the days in a row in the message (from 2).
 */
export function WaterGoalSheet({
  isLimit,
  totalMl,
  streak,
  onAction,
}: {
  isLimit: boolean;
  totalMl: number;
  /** Running water streak (today included). */
  streak: number | null | undefined;
  onAction: () => void;
}) {
  const days = streak && streak >= 2 ? ` ${streak} dias seguidos.` : '';
  return (
    // TODO(motion): feedback sheet entering and leaving.
    <FeedbackSheet
      tone="water"
      title={isLimit ? 'Limite do dia cumprido.' : 'Meta do dia batida.'}
      message={`${formatMl(totalMl)} ml hoje.${days}`}
      pose="streak"
      actionLabel="Continuar"
      onAction={onAction}
    />
  );
}
