import { FeedbackSheet } from '@components';

interface CheckinConfirmedSheetProps {
  /** Confirmed check-ins since the last visit. */
  count: number;
  total: number;
  onAction: () => void;
}

/** "Check-in confirmado." — the feedback sheet at the bottom of Início (success, animated guard). */
export function CheckinConfirmedSheet({ count, total, onAction }: CheckinConfirmedSheetProps) {
  return (
    <FeedbackSheet
      tone="success"
      title={count > 1 ? `${count} check-ins confirmados.` : 'Check-in confirmado.'}
      message={`${total} ${total === 1 ? 'aula confirmada' : 'aulas confirmadas'} no total.`}
      animated
      actionLabel="Continuar"
      onAction={onAction}
    />
  );
}
