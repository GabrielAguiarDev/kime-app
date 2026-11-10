import { Box, Card, Icon, Text } from '@components';
import { goingLabel, locationLabel, timeRangeLabel, type AcademyEvent } from '@domain/Events';

import { EventBadge, openEvent } from './parts';

/**
 * An event in the Aulas agenda, on its day: "Evento" seal, title, time and place.
 * Not a class: no check-in here; a tap opens the event.
 */
export function EventAgendaRow({ event, going, mineGoing = false }: { event: AcademyEvent; going: number; mineGoing?: boolean }) {
  return (
    <Card
      onPress={() => openEvent(event.id)}
      accessibilityLabel={`Evento: ${event.title}, ${timeRangeLabel(event)}. Abrir evento`}
      flexDirection="row"
      alignItems="center"
      gap="s12"
    >
      <Box flex={1} gap="s8">
        <EventBadge />
        <Box gap="s4">
          <Text variant="heading">{event.title}</Text>
          <Text variant="caption">
            {[timeRangeLabel(event), locationLabel(event.location), going > 0 ? goingLabel(going) : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {mineGoing ? (
            <Text variant="caption" color="success">
              Você vai
            </Text>
          ) : null}
        </Box>
      </Box>
      <Icon name="chevronRight" color="textMuted" />
    </Card>
  );
}
