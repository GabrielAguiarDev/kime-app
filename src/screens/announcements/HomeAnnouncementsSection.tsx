import { Box, Card, Icon, Text, TextButton } from '@components';
import { homeAnnouncement, splitAnnouncements, useAnnouncements } from '@domain/Announcements';
import { useModalities, type LocalDate } from '@domain/Classes';

import { ACADEMY_TIME_ZONE, AnnouncementCard, openAnnouncements } from './AnnouncementCard';

/** Lines of a notice on Início (the full text is in Avisos). */
const HOME_LINES = 4;

/**
 * Início, "Aviso" (student, also while blocked for a fee): the pinned notice or
 * one from the last days, with "Ver todos" when there are more. Older notices
 * only leave a link to Avisos. Nothing without notices.
 */
export function StudentAnnouncementsSection({ academyId, today }: { academyId: string; today: LocalDate }) {
  const announcements = useAnnouncements(academyId);
  const modalities = useModalities(academyId);
  const { current } = splitAnnouncements(announcements.data ?? [], today);
  if (current.length === 0) return null;
  const top = homeAnnouncement(current, today, ACADEMY_TIME_ZONE);

  if (!top) {
    return (
      <Card
        onPress={openAnnouncements}
        accessibilityLabel={`Avisos da academia: ${current.length}. Abrir`}
        flexDirection="row"
        alignItems="center"
        gap="s12"
      >
        <Icon name="announcement" color="textMuted" />
        <Text variant="bodyStrong" flex={1}>
          Avisos da academia
        </Text>
        <Text variant="caption">{current.length}</Text>
        <Icon name="chevronRight" color="textMuted" />
      </Card>
    );
  }

  return (
    <Box gap="s8">
      <Box flexDirection="row" alignItems="center" justifyContent="space-between">
        <Text variant="captionCaps">Aviso</Text>
        {current.length > 1 ? <TextButton title="Ver todos" fullWidth={false} onPress={openAnnouncements} /> : null}
      </Box>
      <AnnouncementCard announcement={top} today={today} modalities={modalities.data ?? []} numberOfLines={HOME_LINES} />
    </Box>
  );
}
