import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable } from 'react-native';

import {
  AcademyLogo,
  Avatar,
  BottomSheet,
  Box,
  Button,
  Card,
  EditBadge,
  EmptyState,
  Icon,
  PhotoCropper,
  Screen,
  SelectionCard,
  Text,
  TextButton,
  TextField,
  WheelPicker,
  Spinner,
} from '@components';
import { INACTIVE_DAYS_OPTIONS, useGymSettings, useGymSettingsMutations } from '@domain/Gym';
import { useGymMembers, useTransferOwnership, type GymMember } from '@domain/Membership';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useConfirm } from '@services/confirm';
import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';
import { squarePickerOptions } from '@utils/squareImage';

import { SheetForm } from './shared';

/**
 * Owner: academy settings, top to bottom — logo (required; tap to change),
 * name, the "sumido" threshold, invite codes and, set apart at the end, the sensitive actions
 * (transfer the academy). Modalities and belts have their own screen
 * (Perfil → Modalidades). The time zone is fixed
 * (America/Sao_Paulo) and not shown.
 */
export function AcademySettingsScreen() {
  const { active } = useActiveGym();
  const settings = useGymSettings(active?.gymId);

  // Always render the Screen (its ScrollView) on the first render: iOS only
  // places a scroll view under the large-title header when it is there as the
  // screen appears; mounted later it starts hidden under the header.
  if (!active) {
    return (
      <Screen nativeHeader title="Configurações da academia" onBack={() => router.back()}>
        <Spinner accessibilityLabel="Carregando" />
      </Screen>
    );
  }

  return (
    <Screen nativeHeader title="Configurações da academia" onBack={() => router.back()}>
      {settings.isLoading ? <Spinner /> : null}
      {settings.isError ? (
        <EmptyState
          visual="icon"
          icon="offline"
          title="Não foi possível carregar a academia"
          action={<Button title="Tentar de novo" variant="secondary" onPress={() => settings.refetch()} />}
        />
      ) : null}
      {settings.data ? (
        <Box gap="s40">
          <LogoSection
            gymId={active.gymId}
            name={settings.data.name}
            logoUrl={settings.data.logoUrl}
            logoPath={settings.data.logoPath}
          />
          <NameSection key={settings.data.name} gymId={active.gymId} name={settings.data.name} />
          <InactiveDaysSection gymId={active.gymId} value={settings.data.inactiveAfterDays} />
          <SensitiveSection gymId={active.gymId} gymName={active.gymName} />
        </Box>
      ) : null}
    </Screen>
  );
}

// ------------------------------------------------------------------ logo ---
/**
 * The logo is required: it can be changed, never removed. Same pattern as the
 * profile photo: the logo with a pencil badge; tapping it opens camera /
 * gallery in a sheet.
 */
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
  const { spacing } = useAppTheme();
  const { changeLogo } = useGymSettingsMutations(gymId);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The picker opens after the sheet is gone (one modal at a time).
  const pendingSource = useRef<'camera' | 'library' | null>(null);
  // The picked image waiting on the crop screen.
  const [cropping, setCropping] = useState<string | null>(null);

  const pick = async (from: 'camera' | 'library') => {
    const options = squarePickerOptions(from);
    if (from === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Câmera', 'Permita o acesso à câmera nos Ajustes para fotografar a logo.');
        return;
      }
    }
    const result =
      from === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    setCropping(asset.uri);
  };

  const cropped = (uri: string) => {
    setCropping(null);
    changeLogo.mutate({ uri, previousPath: logoPath }, { onSuccess: () => haptics.success() });
  };

  const choose = (from: 'camera' | 'library') => {
    pendingSource.current = from;
    setSheetOpen(false);
  };

  return (
    <Box alignItems="center" gap="s12">
      <Pressable
        onPress={() => setSheetOpen(true)}
        disabled={changeLogo.isPending}
        accessibilityRole="button"
        accessibilityLabel={logoUrl ? 'Trocar logo da academia' : 'Adicionar logo da academia'}
        hitSlop={spacing.s8}
      >
        <AcademyLogo name={name} url={logoUrl} size="hero" />
        <EditBadge />
      </Pressable>
      {changeLogo.isPending ? <Spinner accessibilityLabel="Enviando logo" /> : null}
      <Text variant="caption" textAlign="center">
        {logoUrl
          ? 'Aparece no topo do app e para quem entra com um código da academia.'
          : 'Adicione a logo da academia: ela aparece no topo do app e para quem entra com um código.'}
      </Text>
      {changeLogo.error ? (
        <Text variant="caption" color="danger">
          {errorMessage(changeLogo.error)}
        </Text>
      ) : null}

      <PhotoCropper source={cropping} shape="square" onCancel={() => setCropping(null)} onDone={cropped} />

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
            Logo da academia
          </Text>
          <Button title="Tirar foto" icon="camera" variant="secondary" onPress={() => choose('camera')} />
          <Button title="Escolher da galeria" icon="image" variant="secondary" onPress={() => choose('library')} />
        </Box>
      </BottomSheet>
    </Box>
  );
}

// ------------------------------------------------------------------ name ---
function NameSection({ gymId, name }: { gymId: string; name: string }) {
  const { update } = useGymSettingsMutations(gymId);
  const [draft, setDraft] = useState(name);
  const trimmed = draft.trim();
  const nameOk = trimmed.length >= 2 && trimmed.length <= 80;
  const dirty = trimmed !== name;

  return (
    <Box gap="s12">
      <TextField
        label="Nome da academia"
        value={draft}
        onChangeText={setDraft}
        maxLength={80}
        autoCapitalize="words"
        errorMessage={draft.length > 0 && !nameOk ? 'O nome precisa ter entre 2 e 80 caracteres.' : undefined}
      />
      {dirty ? (
        <Button
          title="Salvar nome"
          disabled={!nameOk}
          loading={update.isPending}
          onPress={() => update.mutate({ name: trimmed }, { onSuccess: () => haptics.success() })}
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

// ----------------------------------------------------------- "sumidos" ---
/** Days without a confirmed class for a student to show up in "Alunos sumidos" (wheel, saved on "Salvar"). */
function InactiveDaysSection({ gymId, value }: { gymId: string; value: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Card
        onPress={() => setOpen(true)}
        accessibilityLabel={`Alunos sumidos: sem treinar há ${value} dias. Alterar`}
        flexDirection="row"
        alignItems="center"
        gap="s12"
      >
        <Icon name="inactive" color="textMuted" />
        <Box flex={1} gap="s4">
          <Text variant="bodyStrong">Alunos sumidos</Text>
          <Text variant="caption">Sem aula confirmada há esse tempo.</Text>
        </Box>
        <Text variant="bodyStrong">{value} dias</Text>
        <Icon name="chevronRight" color="textMuted" />
      </Card>
      <BottomSheet visible={open} onRequestClose={() => setOpen(false)}>
        {open ? <InactiveDaysSheet gymId={gymId} value={value} onDone={() => setOpen(false)} /> : null}
      </BottomSheet>
    </>
  );
}

function InactiveDaysSheet({ gymId, value, onDone }: { gymId: string; value: number; onDone: () => void }) {
  const { update } = useGymSettingsMutations(gymId);
  const [days, setDays] = useState(value);
  // An old value outside the list still shows on the wheel.
  const options = INACTIVE_DAYS_OPTIONS.includes(value as (typeof INACTIVE_DAYS_OPTIONS)[number])
    ? [...INACTIVE_DAYS_OPTIONS]
    : [...INACTIVE_DAYS_OPTIONS, value].sort((a, b) => a - b);
  return (
    <SheetForm
      title="Considerar sumido após"
      actions={
        <Button
          title="Salvar"
          loading={update.isPending}
          onPress={() => {
            if (days === value) return onDone();
            update.mutate(
              { inactiveAfterDays: days },
              {
                onSuccess: () => {
                  haptics.success();
                  onDone();
                },
                onError: (e) => Alert.alert('Alunos sumidos', errorMessage(e)),
              },
            );
          }}
        />
      }
    >
      <WheelPicker
        accessibilityLabel="Dias sem treinar"
        options={options.map((d) => ({ value: d, label: `${d} dias` }))}
        value={days}
        onChange={setDays}
      />
    </SheetForm>
  );
}

// ------------------------------------------------------ sensitive actions ---
function SensitiveSection({ gymId, gymName }: { gymId: string; gymName: string }) {
  const members = useGymMembers(gymId);
  const transfer = useTransferOwnership(gymId);
  const confirm = useConfirm();
  const [sheetOpen, setSheetOpen] = useState(false);
  // The confirmation opens after the sheet is gone (one modal at a time).
  const chosen = useRef<GymMember | null>(null);
  const instructors = (members.data ?? []).filter((m) => m.role === 'instructor');
  const { border } = useAppTheme();

  const askTransfer = async (member: GymMember) => {
    const ok = await confirm({
      title: `Transferir ${gymName}?`,
      message: `${member.fullName} passa a ser o proprietário: configurações, códigos, professores e remoção de membros. Você continua na academia como professor e não pode desfazer isso sozinho.`,
      confirmLabel: 'Transferir academia',
      tone: 'danger',
    });
    if (!ok) return;
    transfer.mutate(member.id, {
      onSuccess: () => {
        haptics.success();
        router.back();
      },
    });
  };

  return (
    <Box gap="s12" paddingTop="s24" borderTopWidth={border.width} borderColor="border">
      <Text variant="captionCaps" color="danger">
        Ações sensíveis
      </Text>
      <Card gap="s12">
        <Text variant="heading">Transferir academia</Text>
        <Text variant="body" color="textMuted">
          Passa a propriedade para um professor da academia. Para sair da academia, transfira antes.
        </Text>
        {instructors.length === 0 ? (
          <Text variant="caption">A academia ainda não tem professores para receber a transferência.</Text>
        ) : (
          <TextButton
            title="Escolher professor"
            color="danger"
            disabled={transfer.isPending}
            onPress={() => setSheetOpen(true)}
          />
        )}
        {transfer.error ? (
          <Text variant="caption" color="danger">
            {errorMessage(transfer.error)}
          </Text>
        ) : null}
      </Card>

      <BottomSheet
        visible={sheetOpen}
        onRequestClose={() => setSheetOpen(false)}
        onClosed={() => {
          const member = chosen.current;
          chosen.current = null;
          if (member) void askTransfer(member);
        }}
      >
        <SheetForm
          title="Transferir para"
          actions={<Button title="Cancelar" variant="secondary" onPress={() => setSheetOpen(false)} />}
        >
          {instructors.map((member) => (
            <SelectionCard
              key={member.id}
              label={member.fullName}
              leading={<Avatar name={member.fullName} path={member.avatarPath} />}
              selected={false}
              onPress={() => {
                chosen.current = member;
                setSheetOpen(false);
              }}
            />
          ))}
        </SheetForm>
      </BottomSheet>
    </Box>
  );
}
