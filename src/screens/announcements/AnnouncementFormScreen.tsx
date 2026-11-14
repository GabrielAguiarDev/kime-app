import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Box, Button, EmptyState, LoadError, Screen, SelectionCard, Text, TextButton, TextField, Spinner } from '@components';
import {
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_BODY_MIN,
  isValidAnnouncementBody,
  useAnnouncementMutations,
  useAnnouncements,
  type Announcement,
} from '@domain/Announcements';
import { useAcademyToday, useModalities, type LocalDate, type Modality } from '@domain/Classes';
import { parseBrDate, toBrDate } from '@domain/Competition';
import { maskBirthDate } from '@domain/Profile';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';
import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

import { useDeleteAnnouncement } from './useDeleteAnnouncement';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** Staff: new notice, or edit one's own (`?id=`). */
export function AnnouncementFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { userId } = useSession();
  const { active } = useActiveGym();
  const academyId = active?.gymId;
  const announcements = useAnnouncements(academyId);
  const modalities = useModalities(academyId);
  const today = useAcademyToday(academyId);
  const title = id ? 'Editar aviso' : 'Novo aviso';
  const announcement = id ? announcements.data?.find((a) => a.id === id) : undefined;

  if (!academyId || modalities.isLoading || today.isLoading || (id && announcements.isLoading)) {
    return (
      <Screen nativeHeader title={title} onBack={back}>
        <Spinner accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if (modalities.isError || today.isError || !today.data || (id && announcements.isError && !announcement)) {
    return (
      <Screen nativeHeader title={title} onBack={back}>
        <LoadError
          title="Não foi possível carregar o formulário"
          onRetry={() => {
            void modalities.refetch();
            void today.refetch();
            void announcements.refetch();
          }}
        />
      </Screen>
    );
  }
  if (id && (!announcement || announcement.createdBy !== userId)) {
    return (
      <Screen nativeHeader title={title} onBack={back}>
        <EmptyState
          title={announcement ? 'Só quem publicou edita este aviso.' : 'Aviso não encontrado.'}
          description={announcement ? undefined : 'Ele pode ter sido apagado.'}
        />
      </Screen>
    );
  }
  return (
    <AnnouncementForm
      academyId={academyId}
      announcement={announcement}
      modalities={modalities.data ?? []}
      today={today.data}
      title={title}
    />
  );
}

function AnnouncementForm({
  academyId,
  announcement,
  modalities,
  today,
  title,
}: {
  academyId: string;
  announcement: Announcement | undefined;
  modalities: Modality[];
  today: LocalDate;
  title: string;
}) {
  const theme = useAppTheme();
  const { save } = useAnnouncementMutations(academyId);
  const remove = useDeleteAnnouncement(academyId, back);
  const [body, setBody] = useState(announcement?.body ?? '');
  const [modalityId, setModalityId] = useState<string | null>(announcement?.modalityId ?? null);
  const [lastDay, setLastDay] = useState(announcement?.expiresOn ? toBrDate(announcement.expiresOn) : '');

  const bodyTrimmed = body.trim();
  const bodyError =
    bodyTrimmed.length > 0 && !isValidAnnouncementBody(body)
      ? `Use entre ${ANNOUNCEMENT_BODY_MIN} e ${ANNOUNCEMENT_BODY_MAX} caracteres.`
      : undefined;
  const expiresOn = lastDay.trim() ? parseBrDate(lastDay) : null;
  // Editing keeps a last day already past; a new or changed one must be today or later.
  const lastDayError =
    lastDay.length === 10 && !expiresOn
      ? 'Use uma data válida no formato DD/MM/AAAA.'
      : expiresOn && expiresOn < today && expiresOn !== announcement?.expiresOn
        ? 'Use hoje ou uma data futura.'
        : undefined;
  const valid =
    isValidAnnouncementBody(body) && (lastDay.trim() === '' || (!!expiresOn && !lastDayError));

  const submit = () => {
    if (!valid) return;
    save.mutate(
      { id: announcement?.id ?? null, input: { body: bodyTrimmed, modalityId, pinned: false, expiresOn } },
      {
        onSuccess: () => {
          haptics.success();
          back();
        },
      },
    );
  };

  return (
    <Screen
      nativeHeader
      title={title}
      onBack={back}
      footer={
        <Box gap="s8">
          {save.error ? (
            <Text variant="caption" color="danger">
              {errorMessage(save.error)}
            </Text>
          ) : null}
          <Button title={announcement ? 'Salvar' : 'Publicar aviso'} disabled={!valid} loading={save.isPending} onPress={submit} />
        </Box>
      }
    >
      <Box gap="s24">
        <TextField
          label="Aviso"
          value={body}
          onChangeText={setBody}
          placeholder="Ex.: Sem aula na sexta, dia 15, por causa do feriado."
          maxLength={ANNOUNCEMENT_BODY_MAX}
          errorMessage={bodyError}
          autoCapitalize="sentences"
          multiline
          style={{
            minHeight: theme.size.input * 3,
            textAlignVertical: 'top',
            paddingTop: theme.spacing.s12,
            paddingBottom: theme.spacing.s12,
          }}
        />

        <Box gap="s8">
          <Text variant="caption">Para quem</Text>
          <SelectionCard label="Todos da academia" selected={modalityId === null} onPress={() => setModalityId(null)} />
          {modalities.map((m) => (
            <SelectionCard key={m.id} label={m.name} selected={modalityId === m.id} onPress={() => setModalityId(m.id)} />
          ))}
        </Box>

        <Box gap="s8">
          <TextField
            label="Último dia (opcional)"
            value={lastDay}
            onChangeText={(t) => setLastDay(maskBirthDate(t))}
            placeholder="DD/MM/AAAA"
            keyboardType="number-pad"
            maxLength={10}
            errorMessage={lastDayError}
          />
          <Text variant="caption">Depois desse dia, os alunos deixam de ver o aviso. Vazio = até alguém apagar.</Text>
        </Box>

        {announcement ? (
          <TextButton
            title="Apagar aviso"
            color="danger"
            disabled={remove.deletingId === announcement.id}
            onPress={() => void remove.ask(announcement.id)}
          />
        ) : null}
      </Box>
    </Screen>
  );
}
