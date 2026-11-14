import { FeedbackSheet } from '@components';

import { formatVolume } from '@domain/Water';

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
    // FeedbackSheet slides in and out by itself.
    <FeedbackSheet
      tone="water"
      title={isLimit ? 'Limite do dia cumprido.' : 'Meta do dia batida.'}
      message={`${formatVolume(totalMl)} hoje.`}
      pose="streak"
      animated
      actionLabel="Continuar"
      onAction={onAction}
    />
  );
}
