import { useRespondEvent, type RsvpStatus } from '@domain/Events';
import { requestNotificationPermission } from '@infra/notifications';
import { haptics } from '@utils/haptics';

/**
 * "Vou" / "Não vou". Going asks for the notification permission once (only
 * when never answered): it powers the reminder the day before.
 */
export function useRsvp(academyId: string | undefined, userId: string | undefined) {
  const respond = useRespondEvent(academyId, userId);
  const answer = (eventId: string, status: RsvpStatus) =>
    respond.mutate(
      { eventId, status },
      {
        onSuccess: () => {
          void haptics.success();
          if (status === 'going') void requestNotificationPermission().catch(() => undefined);
        },
      },
    );
  return {
    answer,
    pending: respond.isPending,
    /** Event whose answer is being sent (one button spins). */
    pendingEventId: respond.isPending ? respond.variables?.eventId : undefined,
    pendingStatus: respond.isPending ? respond.variables?.status : undefined,
    error: respond.error,
    reset: respond.reset,
  };
}
