import { FeedbackSheet, KimiMascot } from '@components';

import { formatMl } from './format';

/**
 * "Meta do dia batida." / "Limite do dia cumprido." (Início and Água). The
 * water streak grows on this same moment, so this sheet carries it: the
 * mascot plays `streak` and the message adds the days in a row (from 2).
 * Staff see the static mascot.
 */
export function WaterGoalSheet({
  isLimit,
  totalMl,
  streak,
  still,
  onAction,
}: {
  isLimit: boolean;
  totalMl: number;
  /** Running water streak (today included). */
  streak: number | null | undefined;
  still: boolean;
  onAction: () => void;
}) {
  const days = streak && streak >= 2 ? ` ${streak} dias seguidos.` : '';
  return (
    // TODO(motion): feedback sheet entering and leaving.
    <FeedbackSheet
      tone="water"
      title={isLimit ? 'Limite do dia cumprido.' : 'Meta do dia batida.'}
      message={`${formatMl(totalMl)} ml hoje.${days}`}
      mascot={<KimiMascot size="feedback" expression="celebrating" play="streak" still={still} />}
      actionLabel="Continuar"
      onAction={onAction}
    />
  );
}
