import { Image } from 'expo-image';
import { router } from 'expo-router';

import { Avatar, Box, Icon, Text } from '@components';
import { coverUrl, goingLabel, type EventPerson } from '@domain/Events';
import { useAppTheme } from '@theme';

export const openEvent = (id: string) => router.push({ pathname: '/evento', params: { id } });
export const openEvents = () => router.push('/eventos');
export const newEvent = () => router.push('/evento/editar');
export const editEvent = (id: string) => router.push({ pathname: '/evento/editar', params: { id } });

/** "Evento" seal in the Aulas agenda: tells it apart from the classes (icon + text, never color alone). */
export function EventBadge() {
  const { size } = useAppTheme();
  return (
    <Box
      flexDirection="row"
      alignItems="center"
      alignSelf="flex-start"
      gap="s4"
      paddingHorizontal="s8"
      paddingVertical="s4"
      borderRadius="sm"
      backgroundColor="accentSelected"
    >
      <Icon name="party" size={size.badgeIcon} color="accent" active />
      <Text variant="caption" color="accent">
        Evento
      </Text>
    </Box>
  );
}

/** "Cancelado" seal (danger, with icon). */
export function CancelledBadge() {
  const { size } = useAppTheme();
  return (
    <Box
      flexDirection="row"
      alignItems="center"
      alignSelf="flex-start"
      gap="s4"
      paddingHorizontal="s8"
      paddingVertical="s4"
      borderRadius="sm"
      backgroundColor="badgeRejected"
    >
      <Icon name="rejected" size={size.badgeIcon} color="danger" />
      <Text variant="caption" color="danger">
        Cancelado
      </Text>
    </Box>
  );
}

/** Overlapping photos of who is going + "12 vão". */
export function GoingFaces({
  people,
  max = 5,
  size = 32,
}: {
  people: Pick<EventPerson, 'userId' | 'fullName' | 'avatarPath'>[];
  max?: number;
  size?: number;
}) {
  if (people.length === 0) return null;
  return (
    <Box flexDirection="row" alignItems="center" gap="s8" accessible accessibilityLabel={goingLabel(people.length)}>
      <Box flexDirection="row">
        {people.slice(0, max).map((p, index) => (
          <Box key={p.userId} style={{ marginLeft: index ? -Math.round(size * 0.3) : 0 }}>
            <Avatar name={p.fullName} path={p.avatarPath} size={size} />
          </Box>
        ))}
      </Box>
      <Text variant="caption">{goingLabel(people.length)}</Text>
    </Box>
  );
}

/** 16:9 cover (public bucket). Without one: nothing (the card keeps its compact layout). */
export function EventCover({ path, rounded = true }: { path: string | null; rounded?: boolean }) {
  const url = coverUrl(path);
  if (!url) return null;
  return (
    <Box
      width="100%"
      style={{ aspectRatio: 16 / 9 }}
      borderRadius={rounded ? 'md' : 'none'}
      overflow="hidden"
      backgroundColor="surfaceRaised"
      accessibilityRole="image"
      accessibilityLabel="Capa do evento"
    >
      <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={0} />
    </Box>
  );
}

/** Square cover thumbnail for the compact card. Without a cover: nothing. */
export function EventThumb({ path, size = 72 }: { path: string | null; size?: number }) {
  const url = coverUrl(path);
  if (!url) return null;
  return (
    <Box
      width={size}
      height={size}
      borderRadius="md"
      overflow="hidden"
      backgroundColor="surfaceRaised"
      accessibilityRole="image"
      accessibilityLabel="Capa do evento"
    >
      <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={0} />
    </Box>
  );
}
