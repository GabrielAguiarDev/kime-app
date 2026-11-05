import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable } from 'react-native';

import {
  AcademyLogo,
  Avatar,
  BottomSheet,
  Box,
  Button,
  Card,
  EditBadge,
  FeedbackSheet,
  Icon,
  Screen,
  StatusBadge,
  Text,
  TextButton,
} from '@components';
import { useSignOut } from '@domain/Auth';
import { activeMemberships, membershipLabel, useLeaveGym, type Membership } from '@domain/Membership';
import { useAvatarMutations, useMyProfile } from '@domain/Profile';
import { errorMessage } from '@infra';
import { CheckinPrivacySwitch } from '@screens/profile/CheckinPrivacySwitch';
import { RankingSwitch } from '@screens/ranking/RankingSwitch';
import { ClassReminderSwitch } from '@screens/reminders/ClassReminderSwitch';
import { useActiveGym } from '@services/activeGym';
import { SIGN_OUT_CONFIRM, useConfirm } from '@services/confirm';
import { useJoinRequestNotices } from '@services/joinRequests';
import { useSession } from '@services/session';
import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

/**
 * Perfil: avatar (photo or initials; tap for camera / gallery / remove),
 * editable name and e-mail, then grouped sections — Academias, Água (staff),
 * Gestão da academia (owner), Preferências (students) and Conta.
 */
export function ProfileScreen() {
  const { userId } = useSession();
  const { data: profile } = useMyProfile(userId);
  const { memberships, pending, active, isStaff, isOwner, selectGym } = useActiveGym();
  const signOut = useSignOut();
  const leave = useLeaveGym();
  const confirm = useConfirm();
  const gyms = activeMemberships(memberships);
  const rejection = useJoinRequestNotices(userId, memberships);

  const fullName = profile?.fullName || 'Sem nome';

  return (
    <Screen nativeHeader
      title="Perfil"
      bottomInset={false}
      feedback={
        rejection.notice ? (
          <FeedbackSheet
            tone="danger"
            icon="rejected"
            title="Pedido recusado"
            message={
              rejection.notice.gymName
                ? `A ${rejection.notice.gymName} recusou seu pedido de entrada.`
                : 'Uma academia recusou seu pedido de entrada.'
            }
            actionLabel="Entendi"
            onAction={rejection.dismiss}
          />
        ) : undefined
      }
    >
      <Box gap="s32">
        <ProfileHeader
          userId={userId}
          fullName={fullName}
          avatarPath={profile?.avatarPath ?? null}
        />

        <Section title="Academias">
          {gyms.map((m) => {
            const isActive = m.gymId === active?.gymId;
            return (
              <Card
                key={m.id}
                onPress={() => selectGym(m.gymId)}
                selected={isActive}
                disabled={isActive}
                accessibilityLabel={`${m.gymName}, ${membershipLabel(m)}${isActive ? ', academia ativa' : ', tocar para trocar'}`}
                flexDirection="row"
                alignItems="center"
                gap="s12"
              >
                <AcademyLogo name={m.gymName} url={m.gymLogoUrl} size="small" />
                <Box flex={1}>
                  <Text variant="bodyStrong">{m.gymName}</Text>
                  <Text variant="caption">{membershipLabel(m)}</Text>
                </Box>
                {isActive ? <Icon name="check" color="accent" active /> : null}
              </Card>
            );
          })}
          {pending.map((m) => (
            <PendingRequestCard key={m.id} membership={m} />
          ))}
          {/* Same code flow, already signed in (skips the account step). */}
          <Button title="Entrar em outra academia" variant="secondary" icon="plus" onPress={() => router.push('/entrar')} />
          {/* The owner never leaves: they transfer the academy first (Configurações). */}
          {active && !isOwner ? (
            <TextButton
              title={`Sair de ${active.gymName}`}
              color="danger"
              disabled={leave.isPending}
              onPress={async () => {
                const ok = await confirm({
                  title: 'Sair da academia?',
                  message:
                    'Você perde o acesso às aulas e ao histórico desta academia. Para voltar, vai precisar de um novo código.',
                  confirmLabel: 'Sair da academia',
                  tone: 'danger',
                });
                if (ok) leave.mutate(active.id, { onError: (e) => Alert.alert('Academia', errorMessage(e)) });
              }}
            />
          ) : null}
        </Section>

        {isStaff ? (
          <Section title="Água">
            <ManageCard title="Garrafa e peso" icon="drop" onPress={() => router.push('/agua/configurar')} />
          </Section>
        ) : null}

        {isOwner ? (
          <Section title="Gestão da academia">
            <ManageCard title="Configurações da academia" icon="settings" onPress={() => router.push('/academy/settings')} />
            <ManageCard title="Modalidades e faixas" icon="belt" onPress={() => router.push('/academy/modalities')} />
            <ManageCard title="Horários" icon="calendar" onPress={() => router.push('/academy/schedules')} />
            <ManageCard title="Convites" icon="share" onPress={() => router.push('/convites')} />
            <ManageCard title="Campeonatos" icon="trophy" onPress={() => router.push('/academy/championships')} />
          </Section>
        ) : null}

        {isStaff && !isOwner ? (
          <Section title="Academia">
            <ManageCard title="Campeonatos" icon="trophy" onPress={() => router.push('/academy/championships')} />
          </Section>
        ) : null}

        {!isStaff && active ? (
          <Section title="Preferências">
            <ClassReminderSwitch />
            <RankingSwitch />
          </Section>
        ) : null}

        <Section title="Conta">
          <CheckinPrivacySwitch />
          <ManageCard title="Meus dados" icon="user" onPress={() => router.push('/conta/dados')} />
          <TextButton
            title="Sair da conta"
            color="danger"
            disabled={signOut.isPending}
            onPress={async () => {
              if (await confirm(SIGN_OUT_CONFIRM)) {
                signOut.mutate(undefined, { onError: (e) => Alert.alert('Sair', errorMessage(e)) });
              }
            }}
          />
        </Section>
      </Box>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box gap="s12">
      <Text variant="captionCaps">{title}</Text>
      {children}
    </Box>
  );
}

// ---------------------------------------------------------------- header ---
type PhotoAction = 'camera' | 'library' | 'remove';

function ProfileHeader({
  userId,
  fullName,
  avatarPath,
}: {
  userId: string | undefined;
  fullName: string;
  avatarPath: string | null;
}) {
  const { spacing } = useAppTheme();
  const avatar = useAvatarMutations(userId);
  const confirm = useConfirm();
  const [sheetOpen, setSheetOpen] = useState(false);
  // The picker / confirmation opens after the sheet is gone (one modal at a time).
  const pendingAction = useRef<PhotoAction | null>(null);
  const busy = avatar.change.isPending || avatar.remove.isPending;

  const pick = async (from: 'camera' | 'library') => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    };
    if (from === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Câmera', 'Permita o acesso à câmera nos Ajustes para tirar sua foto.');
        return;
      }
    }
    const result =
      from === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    avatar.change.mutate({ uri: asset.uri, previousPath: avatarPath }, { onSuccess: () => haptics.success() });
  };

  const remove = async () => {
    if (!avatarPath) return;
    const ok = await confirm({
      title: 'Remover foto?',
      message: 'Seu perfil passa a mostrar as iniciais do seu nome.',
      confirmLabel: 'Remover',
      tone: 'danger',
    });
    if (ok) avatar.remove.mutate(avatarPath);
  };

  const choose = (action: PhotoAction) => {
    pendingAction.current = action;
    setSheetOpen(false);
  };

  const error = avatar.change.error ?? avatar.remove.error;

  return (
    <Box alignItems="center" gap="s12">
      <Pressable
        onPress={() => setSheetOpen(true)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={avatarPath ? 'Trocar ou remover foto' : 'Adicionar foto'}
        hitSlop={spacing.s8}
      >
        <Avatar name={fullName} path={avatarPath} size="large" />
        {/* The photo is what this tap edits. */}
        <EditBadge />
      </Pressable>
      {busy ? <ActivityIndicator accessibilityLabel="Salvando foto" /> : null}
      <Text variant="title" textAlign="center" accessibilityRole="header">
        {fullName}
      </Text>
      {error ? (
        <Text variant="caption" color="danger" textAlign="center">
          {errorMessage(error)}
        </Text>
      ) : null}

      <BottomSheet
        visible={sheetOpen}
        onRequestClose={() => setSheetOpen(false)}
        onClosed={() => {
          const action = pendingAction.current;
          pendingAction.current = null;
          if (action === 'remove') void remove();
          else if (action) void pick(action);
        }}
      >
        <Box gap="s12">
          <Text variant="heading" accessibilityRole="header">
            Foto do perfil
          </Text>
          <Button title="Tirar foto" icon="camera" variant="secondary" onPress={() => choose('camera')} />
          <Button title="Escolher da galeria" icon="image" variant="secondary" onPress={() => choose('library')} />
          {avatarPath ? <TextButton title="Remover foto" color="danger" onPress={() => choose('remove')} /> : null}
        </Box>
      </BottomSheet>
    </Box>
  );
}

// ------------------------------------------------------------ academies ---
/** A request still waiting: never selectable; the user may cancel it. */
function PendingRequestCard({ membership }: { membership: Membership }) {
  const cancel = useLeaveGym();
  const confirm = useConfirm();
  const name = membership.gymName || 'Academia';

  const ask = async () => {
    const ok = await confirm({
      title: 'Cancelar pedido?',
      message: `Seu pedido para a ${name} deixa de existir. Para entrar depois, use o código de novo.`,
      confirmLabel: 'Cancelar pedido',
      cancelLabel: 'Manter pedido',
      tone: 'danger',
    });
    if (ok) cancel.mutate(membership.id, { onError: (e) => Alert.alert('Pedido', errorMessage(e)) });
  };

  return (
    <Card gap="s12" accessibilityLabel={`${name}, aguardando aprovação`}>
      <Box flexDirection="row" alignItems="center" gap="s12">
        <AcademyLogo name={name} url={membership.gymLogoUrl} size="small" />
        <Box flex={1} gap="s4">
          <Text variant="bodyStrong">{name}</Text>
          <StatusBadge status="pending" label="Aguardando aprovação" />
        </Box>
      </Box>
      <TextButton title="Cancelar pedido" color="danger" disabled={cancel.isPending} onPress={ask} />
    </Card>
  );
}

function ManageCard({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon: 'settings' | 'calendar' | 'belt' | 'user' | 'trophy' | 'drop' | 'share';
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} accessibilityLabel={title} flexDirection="row" alignItems="center" gap="s12">
      <Icon name={icon} color="textMuted" />
      <Text variant="bodyStrong" flex={1}>
        {title}
      </Text>
      <Icon name="chevronRight" color="textMuted" />
    </Card>
  );
}
