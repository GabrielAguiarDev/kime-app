import { Box, Button, Card, StatusBadge, Text } from '@components';
import type { LocalDate } from '@domain/Classes';
import {
  eventCountdownLabel,
  eventWhenLabel,
  goingLabel,
  isFullFor,
  rsvpOpen,
  spotsLeft,
  spotsLabel,
  useEventPeople,
  type AcademyEvent,
  type RsvpStatus,
} from '@domain/Events';

import { CancelledBadge, EventCover, GoingFaces, openEvent } from './parts';

/**
 * One event: cover (when there is one), title, date and time, how
 * long until it, who is going and — for members — "Vou" (or "Você vai").
 * The faces come from academy_event_people, so only cards that show them load it.
 */
export function EventCard({
  event,
  today,
  going,
  mine,
  faces = false,
  cover = false,
  onGoing,
  goingPending = false,
}: {
  event: AcademyEvent;
  today: LocalDate;
  /** People going (from the answers the caller sees). */
  going: number;
  /** The caller's answer; undefined for staff views without RSVP. */
  mine?: RsvpStatus | null;
  /** Photos of who is going ("12 vão"). */
  faces?: boolean;
  cover?: boolean;
  /** Members: the "Vou" button. */
  onGoing?: () => void;
  goingPending?: boolean;
}) {
  const people = useEventPeople(faces ? event.id : undefined);
  const goingPeople = (people.data ?? []).filter((p) => p.status === 'going');
  const left = spotsLeft(event, going);
  const full = isFullFor(event, going, mine ?? null);
  const open = rsvpOpen(event, today);
  const cancelled = !!event.cancelledAt;

  return (
    <Card
      gap="s12"
      onPress={() => openEvent(event.id)}
      accessibilityLabel={`${event.title}. ${eventWhenLabel(event)}. Abrir evento`}
    >
      {cover ? <EventCover path={event.coverPath} /> : null}
      {cancelled ? <CancelledBadge /> : null}
      <Box flexDirection="row" alignItems="flex-end" gap="s12">
        <Box flex={1} gap="s4">
          <Text variant="heading">{event.title}</Text>
          <Text variant="caption">{eventWhenLabel(event)}</Text>
        </Box>
        {!cancelled && event.eventDate >= today ? (
          <Text variant="bodyStrong" color="accent">
            {eventCountdownLabel(today, event.eventDate)}
          </Text>
        ) : null}
      </Box>
      {faces && goingPeople.length ? (
        <GoingFaces people={goingPeople} />
      ) : going > 0 ? (
        <Text variant="caption">{goingLabel(going)}</Text>
      ) : null}
      {left !== null && !cancelled ? (
        <Text variant="caption" color={left === 0 ? 'danger' : 'textMuted'}>
          {spotsLabel(left)}
        </Text>
      ) : null}
      {onGoing && !cancelled ? (
        mine === 'going' ? (
          <StatusBadge status="confirmed" label="Você vai" />
        ) : open ? (
          <Button
            title={full ? 'Vagas esgotadas' : 'Vou'}
            icon={full ? undefined : 'check'}
            disabled={full}
            loading={goingPending}
            onPress={onGoing}
          />
        ) : mine === 'not_going' ? (
          <Text variant="caption">Você respondeu que não vai.</Text>
        ) : (
          <Text variant="caption">O prazo para confirmar terminou.</Text>
        )
      ) : null}
    </Card>
  );
}
