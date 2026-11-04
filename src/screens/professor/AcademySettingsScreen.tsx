import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator } from "react-native";

import {
  AcademyLogo,
  BottomSheet,
  Box,
  Button,
  Card,
  EmptyState,
  Icon,
  Screen,
  SelectionCard,
  Text,
  TextButton,
  TextField,
} from "@components";
import {
  sameModality,
  useCreateModality,
  useModalities,
  useModalityMutations,
  type Modality,
} from "@domain/Classes";
import {
  BR_TIMEZONES,
  useGymSettings,
  useGymSettingsMutations,
} from "@domain/Gym";
import { errorMessage } from "@infra";
import { useActiveGym } from "@services/activeGym";
import { useConfirm } from "@services/confirm";
import { haptics } from "@utils/haptics";

import { SheetForm } from "./shared";

type ModalityEditing = { mode: "new" } | { mode: "edit"; modality: Modality };

/** Professor: academy name, logo, timezone ("today" for classes) and modalities. */
export function AcademySettingsScreen() {
  const { active } = useActiveGym();
  const settings = useGymSettings(active?.gymId);

  if (!active) return null;

  return (
    <Screen title="Configurações da academia" onBack={() => router.back()}>
      {settings.isLoading ? <ActivityIndicator /> : null}
      {settings.isError ? (
        <EmptyState
          visual="icon"
          icon="offline"
          title="Não foi possível carregar a academia"
          action={
            <Button
              title="Tentar de novo"
              variant="secondary"
              onPress={() => settings.refetch()}
            />
          }
        />
      ) : null}
      {settings.data ? (
        <Box gap="s32">
          <LogoSection
            gymId={active.gymId}
            name={settings.data.name}
            logoUrl={settings.data.logoUrl}
            logoPath={settings.data.logoPath}
          />
          <DetailsSection
            key={`${settings.data.name}|${settings.data.timezone}`}
            gymId={active.gymId}
            name={settings.data.name}
            timezone={settings.data.timezone}
          />
          <ModalitiesSection gymId={active.gymId} />
        </Box>
      ) : null}
    </Screen>
  );
}

// ------------------------------------------------------------------ logo ---
function LogoSection({
  gymId,
  name,
  logoUrl,
  logoPath,
}: {
  gymId: string;
  name: string;
  logoUrl: string | null;
  logoPath: string | null;
}) {
  const { changeLogo, removeLogo } = useGymSettingsMutations(gymId);
  const confirm = useConfirm();
  const busy = changeLogo.isPending || removeLogo.isPending;

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    changeLogo.mutate(
      { uri: asset.uri, previousPath: logoPath },
      { onSuccess: () => haptics.success() },
    );
  };

  const remove = async () => {
    if (!logoPath) return;
    const ok = await confirm({
      title: "Remover logo?",
      message: "A academia passa a aparecer com as iniciais do nome.",
      confirmLabel: "Remover",
      tone: "danger",
    });
    if (ok) removeLogo.mutate(logoPath);
  };

  const error = changeLogo.error ?? removeLogo.error;

  return (
    <Box gap="s12">
      <Text variant="captionCaps">Logo</Text>
      <Box flexDirection="row" alignItems="center" gap="s16">
        <AcademyLogo name={name} url={logoUrl} />
        <Box flex={1} gap="s8">
          <Button
            title={logoUrl ? "Trocar logo" : "Escolher logo"}
            variant="secondary"
            loading={changeLogo.isPending}
            disabled={busy}
            onPress={pick}
          />
          {logoUrl ? (
            <TextButton
              title="Remover logo"
              color="danger"
              disabled={busy}
              onPress={remove}
            />
          ) : null}
        </Box>
      </Box>
      <Text variant="caption">
        Aparece para o aluno quando ele entra com o código ou o link de convite.
      </Text>
      {error ? (
        <Text variant="caption" color="danger">
          {errorMessage(error)}
        </Text>
      ) : null}
    </Box>
  );
}

// ------------------------------------------------------- name + timezone ---
function DetailsSection({
  gymId,
  name,
  timezone,
}: {
  gymId: string;
  name: string;
  timezone: string;
}) {
  const { update } = useGymSettingsMutations(gymId);
  const [draftName, setDraftName] = useState(name);
  const [draftTimezone, setDraftTimezone] = useState(timezone);

  const trimmed = draftName.trim();
  const nameOk = trimmed.length >= 2 && trimmed.length <= 80;
  const dirty = trimmed !== name || draftTimezone !== timezone;

  const save = () =>
    update.mutate(
      { name: trimmed, timezone: draftTimezone },
      { onSuccess: () => haptics.success() },
    );

  return (
    <Box gap="s16">
      <Text variant="captionCaps">Academia</Text>
      <TextField
        label="Nome da academia"
        value={draftName}
        onChangeText={setDraftName}
        maxLength={80}
        autoCapitalize="words"
        errorMessage={
          draftName.length > 0 && !nameOk
            ? "O nome precisa ter entre 2 e 80 caracteres."
            : undefined
        }
      />
      <Box gap="s8">
        <Text variant="caption">Fuso horário</Text>
        {BR_TIMEZONES.map((tz) => (
          <SelectionCard
            key={tz.id}
            label={tz.label}
            description={tz.description}
            selected={draftTimezone === tz.id}
            onPress={() => setDraftTimezone(tz.id)}
          />
        ))}
        {!BR_TIMEZONES.some((tz) => tz.id === timezone) ? (
          <SelectionCard
            label={timezone}
            selected={draftTimezone === timezone}
            onPress={() => setDraftTimezone(timezone)}
          />
        ) : null}
        <Text variant="caption">
          Define o “hoje” das aulas: o check-in só vale no dia da aula nesse
          fuso.
        </Text>
      </Box>
      {dirty ? (
        <Button
          title="Salvar alterações"
          disabled={!nameOk}
          loading={update.isPending}
          onPress={save}
        />
      ) : null}
      {update.error ? (
        <Text variant="caption" color="danger">
          {errorMessage(update.error)}
        </Text>
      ) : null}
    </Box>
  );
}

// ------------------------------------------------------------ modalities ---
function ModalitiesSection({ gymId }: { gymId: string }) {
  const modalities = useModalities(gymId);
  const mutations = useModalityMutations(gymId);
  const confirm = useConfirm();
  const [editing, setEditing] = useState<ModalityEditing | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Confirmations open after the sheet is gone (one modal at a time).
  const afterClose = useRef<(() => void) | null>(null);
  const list = modalities.data ?? [];

  const open = (next: ModalityEditing) => {
    setEditing(next);
    setSheetOpen(true);
  };

  const askDelete = (modality: Modality) => {
    afterClose.current = async () => {
      const ok = await confirm({
        title: "Remover modalidade?",
        message: `${modality.name} sai da lista. Os horários que já usam essa modalidade continuam como estão.`,
        confirmLabel: "Remover",
        tone: "danger",
      });
      if (ok) mutations.remove.mutate(modality.id);
    };
    setSheetOpen(false);
  };

  return (
    <Box gap="s12">
      <Text variant="captionCaps">Modalidades</Text>
      {modalities.isLoading ? <ActivityIndicator /> : null}
      {list.map((modality) => (
        <Card
          key={modality.id}
          onPress={() => open({ mode: "edit", modality })}
          accessibilityLabel={`${modality.name}, editar`}
          flexDirection="row"
          alignItems="center"
          gap="s12"
        >
          <Text variant="bodyStrong" flex={1}>
            {modality.name}
          </Text>
          <Icon name="chevronRight" color="textMuted" />
        </Card>
      ))}
      <Button
        title="Adicionar modalidade"
        icon="plus"
        variant="secondary"
        onPress={() => open({ mode: "new" })}
      />
      {mutations.remove.error ? (
        <Text variant="caption" color="danger">
          {errorMessage(mutations.remove.error)}
        </Text>
      ) : null}

      <BottomSheet
        visible={sheetOpen}
        onRequestClose={() => setSheetOpen(false)}
        onClosed={() => {
          setEditing(null);
          const next = afterClose.current;
          afterClose.current = null;
          next?.();
        }}
      >
        {editing ? (
          <ModalityForm
            key={editing.mode === "edit" ? editing.modality.id : "new"}
            gymId={gymId}
            editing={editing}
            existing={list}
            onDone={() => setSheetOpen(false)}
            onDelete={askDelete}
          />
        ) : null}
      </BottomSheet>
    </Box>
  );
}

function ModalityForm({
  gymId,
  editing,
  existing,
  onDone,
  onDelete,
}: {
  gymId: string;
  editing: ModalityEditing;
  existing: Modality[];
  onDone: () => void;
  onDelete: (modality: Modality) => void;
}) {
  const current = editing.mode === "edit" ? editing.modality : null;
  const create = useCreateModality(gymId);
  const { rename } = useModalityMutations(gymId);
  const [name, setName] = useState(current?.name ?? "");

  const trimmed = name.trim();
  const duplicate = existing.some(
    (m) => m.id !== current?.id && sameModality(m.name, trimmed),
  );
  const valid =
    trimmed.length >= 1 &&
    trimmed.length <= 60 &&
    !duplicate &&
    trimmed !== current?.name;
  const mutation = current ? rename : create;
  const options = { onSuccess: () => onDone() };

  const submit = () => {
    if (!valid) return;
    if (current) rename.mutate({ id: current.id, name: trimmed }, options);
    else create.mutate({ name: trimmed, position: existing.length }, options);
  };

  return (
    <SheetForm
      title={current ? "Editar modalidade" : "Nova modalidade"}
      headerAction={
        current
          ? {
              icon: "trash",
              color: "danger",
              accessibilityLabel: "Remover modalidade",
              onPress: () => onDelete(current),
            }
          : undefined
      }
      actions={
        <Button
          title="Salvar"
          disabled={!valid}
          loading={mutation.isPending}
          onPress={submit}
        />
      }
    >
      <TextField
        label="Nome da modalidade"
        value={name}
        onChangeText={setName}
        maxLength={60}
        autoCapitalize="words"
        autoFocus={!current}
        errorMessage={
          duplicate
            ? "A academia já tem essa modalidade."
            : mutation.error
              ? errorMessage(mutation.error)
              : undefined
        }
      />
    </SheetForm>
  );
}
