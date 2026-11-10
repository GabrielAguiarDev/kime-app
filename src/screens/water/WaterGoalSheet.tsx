import { FeedbackSheet } from '@components';

import { formatMl } from './format';

/** "Meta do dia batida." / "Limite do dia cumprido." (Início and Água). */
export function WaterGoalSheet({
  isLimit,
  totalMl,
  onAction,
}: {
  isLimit: boolean;
  totalMl: number;
  onAction: () => void;
}) {
  return (
    // TODO(motion): feedback sheet entering and leaving.
    <FeedbackSheet
      tone="water"
      title={isLimit ? 'Limite do dia cumprido.' : 'Meta do dia batida.'}
      message={`${formatMl(totalMl)} ml hoje.`}
      pose="streak"
      animated
      actionLabel="Continuar"
      onAction={onAction}
    />
  );
}
