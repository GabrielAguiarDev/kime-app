import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { Box, EmptyState, HeaderButton, LoadError, Screen, Text } from '@components';
import { useAcademyToday } from '@domain/Classes';
import { goingCount, myStatus, pastOrCancelledEvents, upcomingEvents, useEventRsvps, useEvents } from '@domain/Events';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';

import { EventCard } from './EventCard';
import { newEvent } from './parts';
import { useRsvp } from './useRsvp';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
/** Held or cancelled events listed below the upcoming ones. */
const PAST_LIMIT = 20;

/**
 * All the events the person sees: upcoming first (members answer "Vou" right
 * on the card), then the held and cancelled ones. Staff create from the header.
 */
export function EventsScreen() {
  const { userId } = useSession();
  const { active, isStaff } = useActiveGym();
  const academyId = active?.gymId;
  const events = useEvents(academyId);
  const rsvps = useEventRsvps(academyId);
  const today = useAcademyToday(academyId);
  const rsvp = useRsvp(academyId, userId);

  const headerRight = isStaff ? <HeaderButton icon="newEvent" accessibilityLabel="Novo evento" onPress={newEvent} /> : undefined;

  if (!academyId || events.isLoading || today.isLoading) {
    return (
      <Screen nativeHeader title="Eventos" onBack={back} headerRight={headerRight}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if (events.isError || today.isError || !today.data) {
    return (
      <Screen nativeHeader title="Eventos" onBack={back} headerRight={headerRight}>
        <LoadError
          title="Não foi possível carregar os eventos"
          onRetry={() => {
            void events.refetch();
            void today.refetch();
          }}
        />
      </Screen>
    );
  }

  const all = events.data ?? [];
  const upcoming = upcomingEvents(all, today.data);
  const past = pastOrCancelledEvents(all, today.data).slice(0, PAST_LIMIT);
  const answers = rsvps.data ?? [];

  return (
    <Screen nativeHeader title="Eventos" onBack={back} headerRight={headerRight}>
      <Box gap="s24">
        {upcoming.length === 0 ? (
          <EmptyState
            title="Nenhum evento marcado."
            description={isStaff ? 'Crie um evento no botão do topo.' : 'Quando a academia marcar um evento, ele aparece aqui.'}
          />
        ) : (
          <Box gap="s12">
            <Text variant="captionCaps">Próximos</Text>
            {upcoming.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                today={today.data!}
                going={goingCount(answers, e.id)}
                mine={myStatus(answers, e.id, userId)}
                cover
                onGoing={() => rsvp.answer(e.id, 'going')}
                goingPending={rsvp.pendingEventId === e.id}
              />
            ))}
            {rsvp.error ? (
              <Text variant="caption" color="danger">
                {errorMessage(rsvp.error)}
              </Text>
            ) : null}
          </Box>
        )}

        {past.length ? (
          <Box gap="s12">
            <Text variant="captionCaps">Anteriores e cancelados</Text>
            {past.map((e) => (
              <EventCard key={e.id} event={e} today={today.data!} going={goingCount(answers, e.id)} />
            ))}
          </Box>
        ) : null}
      </Box>
    </Screen>
  );
}
