import { Box, Button, Text, TextButton } from '@components';
import type { LocalDate } from '@domain/Classes';
import { goingCount, myStatus, upcomingEvents, useEventRsvps, useEvents } from '@domain/Events';
import { errorMessage } from '@infra';
import { useAppTheme } from '@theme';

import { EventCard } from './EventCard';
import { newEvent, openEvents } from './parts';
import { useRsvp } from './useRsvp';

/**
 * Início, "Evento" (student): the nearest upcoming event the student is meant
 * for, with who is going and "Vou"; "Ver todos" when there are more. Nothing
 * when there is no event.
 */
export function StudentEventsSection({ academyId, userId, today }: { academyId: string; userId: string; today: LocalDate }) {
  const events = useEvents(academyId);
  const rsvps = useEventRsvps(academyId);
  const rsvp = useRsvp(academyId, userId);
  const upcoming = upcomingEvents(events.data ?? [], today);
  const next = upcoming[0];
  if (!next) return null;
  const answers = rsvps.data ?? [];

  return (
    <Box gap="s8">
      <Box flexDirection="row" alignItems="center" justifyContent="space-between">
        <Text variant="captionCaps">{upcoming.length > 1 ? 'Próximo evento' : 'Evento'}</Text>
        {upcoming.length > 1 ? <TextButton title="Ver todos" fullWidth={false} onPress={openEvents} /> : null}
      </Box>
      <EventCard
        event={next}
        today={today}
        going={goingCount(answers, next.id)}
        mine={myStatus(answers, next.id, userId)}
        faces
        cover
        compact
        onGoing={() => rsvp.answer(next.id, 'going')}
        goingPending={rsvp.pendingEventId === next.id}
      />
      {rsvp.error ? (
        <Text variant="caption" color="danger">
          {errorMessage(rsvp.error)}
        </Text>
      ) : null}
    </Box>
  );
}

/** Upcoming events shown on the staff Início. */
const STAFF_HOME_EVENTS = 2;

/**
 * Início, "Eventos" (owner / professor): the next events with who is going,
 * "Ver todos" and "Novo evento".
 */
export function StaffEventsSection({ academyId, today }: { academyId: string; today: LocalDate }) {
  const theme = useAppTheme();
  const events = useEvents(academyId);
  const rsvps = useEventRsvps(academyId);
  const upcoming = upcomingEvents(events.data ?? [], today);
  const answers = rsvps.data ?? [];
  // "Ver todos" keeps its 52 pt touch target; the row takes the caption's height
  // in the layout, so the space around "Eventos" matches the other sections.
  const showAll = (events.data ?? []).length > 0;
  const headerPull = showAll ? -(theme.size.button - theme.textVariants.captionCaps.lineHeight) / 2 : 0;

  return (
    <Box gap="s12">
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" style={{ marginVertical: headerPull }}>
        <Text variant="captionCaps">Eventos</Text>
        {showAll ? <TextButton title="Ver todos" fullWidth={false} onPress={openEvents} /> : null}
      </Box>
      {upcoming.slice(0, STAFF_HOME_EVENTS).map((e) => (
        <EventCard key={e.id} event={e} today={today} going={goingCount(answers, e.id)} faces />
      ))}
      {events.data && upcoming.length === 0 ? (
        <Text variant="body" color="textMuted">
          Nenhum evento marcado.
        </Text>
      ) : null}
      <Button title="Novo evento" icon="newEvent" variant="secondary" onPress={newEvent} />
    </Box>
  );
}
