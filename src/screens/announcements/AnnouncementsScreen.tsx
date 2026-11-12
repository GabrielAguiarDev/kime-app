import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { Box, EmptyState, HeaderButton, LoadError, Screen, Text } from '@components';
import { splitAnnouncements, useAnnouncements, type Announcement } from '@domain/Announcements';
import { useAcademyToday, useModalities, type LocalDate, type Modality } from '@domain/Classes';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';

import { AnnouncementCard, newAnnouncement } from './AnnouncementCard';
import { useDeleteAnnouncement } from './useDeleteAnnouncement';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

/**
 * Avisos: every notice the person sees, pinned first, newest first. Staff
 * publish from the header and also see the ones past their last day
 * ("Encerrados"); the author edits, the author or the owner deletes.
 * Not gated by the fee block (user decision: a blocked student still sees them).
 */
export function AnnouncementsScreen() {
  const { active, isStaff } = useActiveGym();
  const academyId = active?.gymId;
  const announcements = useAnnouncements(academyId);
  const modalities = useModalities(academyId);
  const today = useAcademyToday(academyId);

  const headerRight = isStaff ? (
    <HeaderButton icon="plus" accessibilityLabel="Novo aviso" onPress={newAnnouncement} />
  ) : undefined;

  if (!academyId || announcements.isLoading || today.isLoading) {
    return (
      <Screen nativeHeader title="Avisos" onBack={back} headerRight={headerRight}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if (announcements.isError || today.isError || !today.data) {
    return (
      <Screen nativeHeader title="Avisos" onBack={back} headerRight={headerRight}>
        <LoadError
          title="Não foi possível carregar os avisos"
          onRetry={() => {
            void announcements.refetch();
            void today.refetch();
          }}
        />
      </Screen>
    );
  }

  const { current, expired } = splitAnnouncements(announcements.data ?? [], today.data);

  return (
    <Screen nativeHeader title="Avisos" onBack={back} headerRight={headerRight}>
      <Box gap="s24">
        {current.length === 0 ? (
          <EmptyState
            visual="icon"
            icon="announcement"
            title="Nenhum aviso."
            description={isStaff ? 'Publique um aviso no botão do topo.' : 'Quando a academia publicar um aviso, ele aparece aqui.'}
          />
        ) : (
          <AnnouncementList academyId={academyId} list={current} today={today.data} modalities={modalities.data ?? []} />
        )}
        {isStaff && expired.length > 0 ? (
          <Box gap="s12">
            <Text variant="captionCaps">Encerrados</Text>
            <AnnouncementList academyId={academyId} list={expired} today={today.data} modalities={modalities.data ?? []} />
          </Box>
        ) : null}
      </Box>
    </Screen>
  );
}

function AnnouncementList({
  academyId,
  list,
  today,
  modalities,
}: {
  academyId: string;
  list: Announcement[];
  today: LocalDate;
  modalities: Modality[];
}) {
  const { userId } = useSession();
  const { isStaff, isOwner } = useActiveGym();
  const remove = useDeleteAnnouncement(academyId);
  return (
    <Box gap="s12">
      {list.map((a) => {
        const mine = isStaff && !!userId && a.createdBy === userId;
        return (
          <AnnouncementCard
            key={a.id}
            announcement={a}
            today={today}
            modalities={modalities}
            canEdit={mine}
            onDelete={mine || isOwner ? () => void remove.ask(a.id) : undefined}
            deleting={remove.deletingId === a.id}
          />
        );
      })}
    </Box>
  );
}
