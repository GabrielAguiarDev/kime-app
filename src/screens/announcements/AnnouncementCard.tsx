import { router } from 'expo-router';

import { Avatar, Box, Card, Icon, Text, TextButton } from '@components';
import { expiryLabel, isExpired, publishedLabel, type Announcement } from '@domain/Announcements';
import type { LocalDate, Modality } from '@domain/Classes';
import { useAppTheme } from '@theme';

/** Academy calendar (fixed time zone, see academies.timezone). */
export const ACADEMY_TIME_ZONE = 'America/Sao_Paulo';

export const openAnnouncements = () => router.push('/avisos');
export const newAnnouncement = () => router.push('/aviso/editar');
export const editAnnouncement = (id: string) => router.push({ pathname: '/aviso/editar', params: { id } });

/**
 * One notice: "Fixado" seal, the text, the audience (when one modality) and
 * the last day, then the author and when it was published. Staff get "Editar"
 * (author) and "Apagar" (author or owner) when `onDelete` / `canEdit` say so.
 */
export function AnnouncementCard({
  announcement: a,
  today,
  modalities,
  canEdit = false,
  onDelete,
  deleting = false,
  numberOfLines,
}: {
  announcement: Announcement;
  today: LocalDate;
  modalities: Modality[];
  canEdit?: boolean;
  onDelete?: () => void;
  deleting?: boolean;
  /** Clamp the text (Início). */
  numberOfLines?: number;
}) {
  const { size } = useAppTheme();
  const modality = a.modalityId ? modalities.find((m) => m.id === a.modalityId) : null;
  const expiry = expiryLabel(a, today);
  const expired = isExpired(a, today);
  const tags = [modality ? modality.name : null, expiry].filter(Boolean).join(' · ');
  const author = a.authorName ?? 'Academia';

  return (
    <Card gap="s12" selected={a.pinned && !expired}>
      {a.pinned && !expired ? (
        <Box flexDirection="row" alignItems="center" gap="s4">
          <Icon name="pin" size={size.badgeIcon} color="accent" active />
          <Text variant="caption" color="accent">
            Fixado
          </Text>
        </Box>
      ) : null}
      <Text variant="body" color={expired ? 'textMuted' : 'text'} numberOfLines={numberOfLines}>
        {a.body}
      </Text>
      {tags ? <Text variant="caption">{tags}</Text> : null}
      <Box flexDirection="row" alignItems="center" gap="s8">
        <Avatar name={author} path={a.authorAvatarPath} size={size.badgeIcon * 2} />
        <Text variant="caption" flex={1} numberOfLines={1}>
          {author} · {publishedLabel(a.createdAt, today, ACADEMY_TIME_ZONE)}
        </Text>
      </Box>
      {canEdit || onDelete ? (
        <Box flexDirection="row" gap="s8">
          {canEdit ? <TextButton title="Editar" fullWidth={false} onPress={() => editAnnouncement(a.id)} /> : null}
          {onDelete ? (
            <TextButton title="Apagar" color="danger" fullWidth={false} disabled={deleting} onPress={onDelete} />
          ) : null}
        </Box>
      ) : null}
    </Card>
  );
}
