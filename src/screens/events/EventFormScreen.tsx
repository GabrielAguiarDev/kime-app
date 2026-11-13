import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable } from 'react-native';

import {
  BottomSheet,
  Box,
  Button,
  EditBadge,
  EmptyState,
  Icon,
  LoadError,
  Screen,
  SelectionCard,
  Text,
  TextButton,
  TextField,
  Spinner,
} from '@components';
import { useAcademyToday, useModalities, type LocalDate, type Modality } from '@domain/Classes';
import { parseBrDate, toBrDate } from '@domain/Competition';
import {
  coverUrl,
  EVENT_DESCRIPTION_MAX,
  EVENT_LOCATION_MAX,
  EVENT_TITLE_MAX,
  EVENT_TITLE_MIN,
  maskTime,
  parseCapacity,
  parsePrice,
  parseTime,
  priceToText,
  useEventMutations,
  useEvents,
  type AcademyEvent,
} from '@domain/Events';
import { maskBirthDate } from '@domain/Profile';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useAppTheme } from '@theme';
import { coverPickerOptions } from '@utils/coverImage';
import { haptics } from '@utils/haptics';

import { openEvent } from './parts';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** Staff: create (no `id`) or edit an event. */
export function EventFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { active } = useActiveGym();
  const academyId = active?.gymId;
  const events = useEvents(academyId);
  const modalities = useModalities(academyId);
  const today = useAcademyToday(academyId);
  const title = id ? 'Editar evento' : 'Novo evento';
  const event = id ? events.data?.find((e) => e.id === id) : undefined;

  if (!academyId || modalities.isLoading || today.isLoading || (id && events.isLoading)) {
    return (
      <Screen nativeHeader title={title} onBack={back}>
        <Spinner accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if (modalities.isError || today.isError || !today.data || (id && events.isError && !event)) {
    return (
      <Screen nativeHeader title={title} onBack={back}>
        <LoadError
          title="Não foi possível carregar o formulário"
          onRetry={() => {
            void modalities.refetch();
            void today.refetch();
            void events.refetch();
          }}
        />
      </Screen>
    );
  }
  if (id && (!event || event.cancelledAt)) {
    return (
      <Screen nativeHeader title={title} onBack={back}>
        <EmptyState title={event ? 'Evento cancelado.' : 'Evento não encontrado.'} description="Ele não pode mais ser editado." />
      </Screen>
    );
  }
  return (
    <EventForm academyId={academyId} event={event} modalities={modalities.data ?? []} today={today.data} title={title} />
  );
}

function EventForm({
  academyId,
  event,
  modalities,
  today,
  title,
}: {
  academyId: string;
  event: AcademyEvent | undefined;
  modalities: Modality[];
  today: LocalDate;
  title: string;
}) {
  const theme = useAppTheme();
  const { save } = useEventMutations(academyId);
  const [name, setName] = useState(event?.title ?? '');
  const [date, setDate] = useState(event ? toBrDate(event.eventDate) : '');
  const [start, setStart] = useState(event?.startTime ?? '');
  const [end, setEnd] = useState(event?.endTime ?? '');
  const [atAcademy, setAtAcademy] = useState(!event?.location);
  const [location, setLocation] = useState(event?.location ?? '');
  const [allModalities, setAllModalities] = useState(event ? event.allModalities : true);
  const [modalityIds, setModalityIds] = useState<string[]>(event?.modalityIds ?? []);
  const [description, setDescription] = useState(event?.description ?? '');
  const [price, setPrice] = useState(priceToText(event?.priceCents ?? null));
  const [capacity, setCapacity] = useState(event?.capacity ? String(event.capacity) : '');
  const [deadline, setDeadline] = useState(event?.rsvpDeadline ? toBrDate(event.rsvpDeadline) : '');
  /** undefined: keep the current cover; null: remove; string: a new local image. */
  const [coverUri, setCoverUri] = useState<string | null | undefined>(undefined);

  // ------------------------------------------------------------ checks ---
  const trimmed = name.trim();
  const nameError =
    trimmed.length > 0 && trimmed.length < EVENT_TITLE_MIN ? `Use entre ${EVENT_TITLE_MIN} e ${EVENT_TITLE_MAX} caracteres.` : undefined;
  const eventDate = parseBrDate(date);
  // Editing keeps a date already in the past; a new date must be today or later.
  const pastDate = !!eventDate && eventDate < today && eventDate !== event?.eventDate;
  const dateError =
    date.length === 10 && !eventDate ? 'Use uma data válida no formato DD/MM/AAAA.' : pastDate ? 'Use hoje ou uma data futura.' : undefined;
  const startTime = parseTime(start);
  const startError = start.length === 5 && !startTime ? 'Use um horário válido, como 19:00.' : undefined;
  const endTime = end.trim() ? parseTime(end) : null;
  const endError = end.length === 5 && !endTime ? 'Use um horário válido, como 23:00.' : undefined;
  const priceParsed = parsePrice(price);
  const capacityParsed = parseCapacity(capacity);
  const rsvpDeadline = deadline.trim() ? parseBrDate(deadline) : null;
  const deadlineError =
    deadline.length === 10 && !rsvpDeadline
      ? 'Use uma data válida no formato DD/MM/AAAA.'
      : rsvpDeadline && eventDate && rsvpDeadline > eventDate
        ? 'O prazo precisa ser até o dia do evento.'
        : rsvpDeadline && rsvpDeadline < today && rsvpDeadline !== event?.rsvpDeadline
          ? 'Use hoje ou uma data futura.'
          : undefined;
  const locationOk = atAcademy || (location.trim().length > 0 && location.length <= EVENT_LOCATION_MAX);
  const modalitiesOk = allModalities || modalityIds.length > 0;

  const valid =
    trimmed.length >= EVENT_TITLE_MIN &&
    trimmed.length <= EVENT_TITLE_MAX &&
    !!eventDate &&
    !pastDate &&
    !!startTime &&
    (end.trim() === '' || !!endTime) &&
    locationOk &&
    modalitiesOk &&
    priceParsed.valid &&
    capacityParsed.valid &&
    (deadline.trim() === '' || (!!rsvpDeadline && !deadlineError)) &&
    description.length <= EVENT_DESCRIPTION_MAX;

  const submit = () => {
    if (!valid || !eventDate || !startTime) return;
    save.mutate(
      {
        id: event?.id ?? null,
        previousCover: event?.coverPath ?? null,
        input: {
          title: trimmed,
          description,
          eventDate,
          startTime,
          endTime,
          location: atAcademy ? null : location.trim(),
          modalityIds: allModalities ? [] : modalityIds,
          priceCents: priceParsed.cents,
          capacity: capacityParsed.capacity,
          rsvpDeadline,
          coverUri,
        },
      },
      {
        onSuccess: (savedId) => {
          void haptics.success();
          if (event) back();
          else router.replace({ pathname: '/evento', params: { id: savedId } });
        },
      },
    );
  };

  const toggleModality = (id: string) =>
    setModalityIds((current) => (current.includes(id) ? current.filter((m) => m !== id) : [...current, id]));

  const currentCover = coverUri === undefined ? coverUrl(event?.coverPath) : coverUri;

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
          <Button title={event ? 'Salvar' : 'Publicar evento'} disabled={!valid} loading={save.isPending} onPress={submit} />
        </Box>
      }
    >
      <Box gap="s24">
        <CoverPicker url={currentCover ?? null} onPick={setCoverUri} onRemove={() => setCoverUri(null)} />

        <TextField
          label="Título"
          value={name}
          onChangeText={setName}
          placeholder="Ex.: Confraternização de fim de ano"
          maxLength={EVENT_TITLE_MAX}
          errorMessage={nameError}
          autoCapitalize="sentences"
        />

        <TextField
          label="Data"
          value={date}
          onChangeText={(t) => setDate(maskBirthDate(t))}
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          maxLength={10}
          errorMessage={dateError}
        />
        <Box flexDirection="row" gap="s12">
          <Box flex={1}>
            <TextField
              label="Início"
              value={start}
              onChangeText={(t) => setStart(maskTime(t))}
              placeholder="19:00"
              keyboardType="number-pad"
              maxLength={5}
              errorMessage={startError}
            />
          </Box>
          <Box flex={1}>
            <TextField
              label="Término (opcional)"
              value={end}
              onChangeText={(t) => setEnd(maskTime(t))}
              placeholder="23:00"
              keyboardType="number-pad"
              maxLength={5}
              errorMessage={endError}
            />
          </Box>
        </Box>

        <Box gap="s8">
          <Text variant="caption">Local</Text>
          <Box flexDirection="row" gap="s8">
            <SelectionCard flex={1} label="Na academia" selected={atAcademy} onPress={() => setAtAcademy(true)} />
            <SelectionCard flex={1} label="Outro local" selected={!atAcademy} onPress={() => setAtAcademy(false)} />
          </Box>
          {!atAcademy ? (
            <TextField
              label="Endereço ou nome do lugar"
              value={location}
              onChangeText={setLocation}
              placeholder="Ex.: Churrascaria do Zé, Rua das Flores, 120"
              maxLength={EVENT_LOCATION_MAX}
            />
          ) : null}
        </Box>

        <Box gap="s8">
          <Text variant="caption">Modalidades</Text>
          <SelectionCard
            label="Todas as modalidades"
            selected={allModalities}
            onPress={() => setAllModalities(true)}
          />
          {modalities.map((m) => (
            <SelectionCard
              key={m.id}
              label={m.name}
              selected={!allModalities && modalityIds.includes(m.id)}
              onPress={() => {
                if (allModalities) {
                  setAllModalities(false);
                  setModalityIds([m.id]);
                } else toggleModality(m.id);
              }}
            />
          ))}
          <Text variant="caption">
            {allModalities ? 'Todos os alunos veem o evento.' : 'Só os alunos das modalidades escolhidas veem o evento.'}
          </Text>
        </Box>

        <TextField
          label="Descrição (opcional)"
          value={description}
          onChangeText={setDescription}
          placeholder="O que vai acontecer, o que levar, traje…"
          maxLength={EVENT_DESCRIPTION_MAX}
          multiline
          style={{
            minHeight: theme.size.input * 2,
            textAlignVertical: 'top',
            paddingTop: theme.spacing.s12,
            paddingBottom: theme.spacing.s12,
          }}
        />

        <Box gap="s8">
          <TextField
            label="Valor (opcional)"
            value={price}
            onChangeText={(t) => setPrice(t.replace(/[^\d.,]/g, ''))}
            placeholder="Gratuito"
            keyboardType="decimal-pad"
            unit="R$"
            maxLength={12}
            errorMessage={priceParsed.valid ? undefined : 'Use um valor como 40,00.'}
          />
          <Text variant="caption">Vazio = gratuito. O pagamento é feito direto com a academia.</Text>
        </Box>

        <TextField
          label="Limite de vagas (opcional)"
          value={capacity}
          onChangeText={(t) => setCapacity(t.replace(/\D/g, ''))}
          placeholder="Sem limite"
          keyboardType="number-pad"
          maxLength={5}
          errorMessage={capacityParsed.valid ? undefined : 'Use um número a partir de 1.'}
        />

        <Box gap="s8">
          <TextField
            label="Prazo para confirmar (opcional)"
            value={deadline}
            onChangeText={(t) => setDeadline(maskBirthDate(t))}
            placeholder="DD/MM/AAAA"
            keyboardType="number-pad"
            maxLength={10}
            errorMessage={deadlineError}
          />
          <Text variant="caption">Sem prazo, dá para responder até o dia do evento.</Text>
        </Box>

        {event ? (
          <TextButton title="Ver evento" fullWidth onPress={() => openEvent(event.id)} />
        ) : null}
      </Box>
    </Screen>
  );
}

/** Optional 16:9 cover: tap to take or pick a photo; "Remover capa". */
function CoverPicker({ url, onPick, onRemove }: { url: string | null; onPick: (uri: string) => void; onRemove: () => void }) {
  const theme = useAppTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  // The picker opens after the sheet is gone (one modal at a time).
  const pendingSource = useRef<'camera' | 'library' | null>(null);

  const pick = async (from: 'camera' | 'library') => {
    if (from === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Câmera', 'Permita o acesso à câmera nos Ajustes para fotografar a capa.');
        return;
      }
    }
    const options = coverPickerOptions(from);
    const result =
      from === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (asset) onPick(asset.uri);
  };

  const choose = (from: 'camera' | 'library') => {
    pendingSource.current = from;
    setSheetOpen(false);
  };

  return (
    <Box gap="s8">
      <Text variant="caption">Capa (opcional)</Text>
      <Pressable
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={url ? 'Trocar a capa do evento' : 'Adicionar capa ao evento'}
      >
        <Box
          width="100%"
          style={{ aspectRatio: 16 / 9 }}
          borderRadius="lg"
          borderWidth={theme.border.width}
          borderColor="border"
          backgroundColor="surface"
          overflow="hidden"
          alignItems="center"
          justifyContent="center"
          gap="s8"
        >
          {url ? (
            <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={0} />
          ) : (
            <>
              <Icon name="image" color="textMuted" />
              <Text variant="caption">Adicionar capa</Text>
            </>
          )}
        </Box>
        {url ? <EditBadge /> : null}
      </Pressable>
      {url ? <TextButton title="Remover capa" color="danger" fullWidth onPress={onRemove} /> : null}

      <BottomSheet
        visible={sheetOpen}
        onRequestClose={() => setSheetOpen(false)}
        onClosed={() => {
          const from = pendingSource.current;
          pendingSource.current = null;
          if (from) void pick(from);
        }}
      >
        <Box gap="s12">
          <Text variant="heading" accessibilityRole="header">
            Capa do evento
          </Text>
          <Button title="Tirar foto" icon="camera" variant="secondary" onPress={() => choose('camera')} />
          <Button title="Escolher da galeria" icon="image" variant="secondary" onPress={() => choose('library')} />
        </Box>
      </BottomSheet>
    </Box>
  );
}
