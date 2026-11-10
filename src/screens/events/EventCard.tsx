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

import { CancelledBadge, EventCover, EventThumb, GoingFaces, openEvent } from './parts';

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
  compact = false,
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
  /** Short layout (Início): cover as a thumbnail beside the text, faces and "Vou" on one row. */
  compact?: boolean;
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
  const countdown = !cancelled && event.eventDate >= today ? eventCountdownLabel(today, event.eventDate) : null;

  if (compact) {
    const showFaces = faces && goingPeople.length > 0;
    const action =
      onGoing && !cancelled ? (
        mine === 'going' ? (
          <StatusBadge status="confirmed" label="Você vai" />
        ) : open ? (
          <Button
            title={full ? 'Esgotado' : 'Vou'}
            icon={full ? undefined : 'check'}
            fullWidth={false}
            disabled={full}
            loading={goingPending}
            onPress={onGoing}
          />
        ) : (
          <Text variant="caption">{mine === 'not_going' ? 'Você não vai' : 'Prazo encerrado'}</Text>
        )
      ) : null;

    return (
      <Card
        gap="s12"
        onPress={() => openEvent(event.id)}
        accessibilityLabel={`${event.title}. ${eventWhenLabel(event)}. Abrir evento`}
      >
        <Box flexDirection="row" alignItems="center" gap="s12">
          {cover ? <EventThumb path={event.coverPath} /> : null}
          <Box flex={1} gap="s4">
            {cancelled ? <CancelledBadge /> : null}
            <Text variant="bodyStrong" numberOfLines={2}>
              {event.title}
            </Text>
            <Text variant="caption" numberOfLines={1}>
              {eventWhenLabel(event)}
            </Text>
            {countdown ? (
              <Text variant="caption" color="accent">
                {countdown}
              </Text>
            ) : null}
          </Box>
        </Box>
        {showFaces || going > 0 || action || (left !== null && !cancelled) ? (
          <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap="s12">
            <Box flex={1} gap="s4">
              {showFaces ? (
                <GoingFaces people={goingPeople} max={4} size={24} />
              ) : going > 0 ? (
                <Text variant="caption">{goingLabel(going)}</Text>
              ) : null}
              {left !== null && !cancelled ? (
                <Text variant="caption" color={left === 0 ? 'danger' : 'textMuted'}>
                  {spotsLabel(left)}
                </Text>
              ) : null}
            </Box>
            {action}
          </Box>
        ) : null}
      </Card>
    );
  }

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
        {countdown ? (
          <Text variant="bodyStrong" color="accent">
            {countdown}
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
