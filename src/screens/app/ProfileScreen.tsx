import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable } from 'react-native';

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
  PhotoCropper,
  Screen,
  Text,
  TextButton,
} from '@components';
import { useSignOut } from '@domain/Auth';
import { activeMemberships, membershipLabel } from '@domain/Membership';
import { useAvatarMutations, useMyProfile } from '@domain/Profile';
import { errorMessage } from '@infra';
import { MyFightRecordCard } from '@screens/competition/FightRecord';
import { RankingSwitch } from '@screens/ranking/RankingSwitch';
import { ClassReminderSwitch } from '@screens/reminders/ClassReminderSwitch';
import { useActiveGym } from '@services/activeGym';
import { SIGN_OUT_CONFIRM, useConfirm } from '@services/confirm';
import { useJoinRequestNotices } from '@services/joinRequests';
import { useSession } from '@services/session';
import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';
import { squarePickerOptions } from '@utils/squareImage';

/**
 * Perfil: avatar (photo or initials; tap for camera / gallery / remove), name
 * and, for competitors, the cartel of the selected modality (opens the fight
 * history), then grouped sections — Academia (one row → Academias screen),
 * Água (staff), Gestão da academia (owner), Treinos and Preferências
 * (students) and Conta.
 */
export function ProfileScreen() {
  const { userId } = useSession();
  const { data: profile } = useMyProfile(userId);
  const { memberships, active, isStaff, isOwner } = useActiveGym();
  const signOut = useSignOut();
  const confirm = useConfirm();
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

        <Section title="Academia">
          <AcademyRow />
        </Section>


        {isStaff ? (
          <Section title="Água">
            <ManageCard title="Garrafa e meta de água" icon="drop" onPress={() => router.push('/agua/configurar')} />
          </Section>
        ) : null}

        {isOwner ? (
          <Section title="Gestão da academia">
            <ManageCard title="Configurações da academia" icon="settings" onPress={() => router.push('/academy/settings')} />
            <ManageCard title="Modalidades e faixas" icon="belt" onPress={() => router.push('/academy/modalities')} />
            <ManageCard title="Horários" icon="calendar" onPress={() => router.push('/academy/schedules')} />
            <ManageCard title="Convites" icon="share" onPress={() => router.push('/convites')} />
            <ManageCard title="Campeonatos" icon="trophy" onPress={() => router.push('/academy/championships')} />
            <ManageCard title="Financeiro" icon="money" onPress={() => router.push('/financeiro')} />
          </Section>
        ) : null}

        {isStaff && !isOwner ? (
          <Section title="Academia">
            <ManageCard title="Campeonatos" icon="trophy" onPress={() => router.push('/academy/championships')} />
          </Section>
        ) : null}

        {!isStaff && active ? (
          <Section title="Treinos">
            <ManageCard title="Relatório de treinos" icon="chart" onPress={() => router.push('/relatorio')} />
          </Section>
        ) : null}

        {!isStaff && active ? (
          <Section title="Preferências">
            <ClassReminderSwitch />
            <RankingSwitch />
          </Section>
        ) : null}

        <Section title="Conta">
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
  // The picked photo waiting on the crop screen (mirror: iOS front camera).
  const [cropping, setCropping] = useState<{ uri: string; mirror: boolean } | null>(null);

  const pick = async (from: 'camera' | 'library') => {
    const options = squarePickerOptions(from);
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
    // On iOS, the captured profile photo comes back mirrored after the native camera flow.
    // Correct the saved avatar and its thumbnail; gallery images are already oriented as chosen.
    setCropping({ uri: asset.uri, mirror: from === 'camera' && Platform.OS === 'ios' });
  };

  const cropped = (uri: string) => {
    const mirror = cropping?.mirror ?? false;
    setCropping(null);
    avatar.change.mutate({ uri, previousPath: avatarPath, mirror }, { onSuccess: () => haptics.success() });
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
      {/* The photo opens full screen; only the pencil edits it (without a photo, the circle adds one too).
          The padding / negative margin keep the layout and give the pencil's larger touch area room
          inside its parent (Android drops touches outside the parent's bounds). */}
      <Box style={{ padding: spacing.s16, margin: -spacing.s16 }}>
        {avatarPath ? (
          <Avatar name={fullName} path={avatarPath} size="large" expandable />
        ) : (
          <Pressable
            onPress={() => setSheetOpen(true)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Adicionar foto"
            hitSlop={spacing.s8}
          >
            <Avatar name={fullName} path={avatarPath} size="large" />
          </Pressable>
        )}
        <EditBadge
          onPress={() => setSheetOpen(true)}
          disabled={busy}
          accessibilityLabel={avatarPath ? 'Trocar ou remover foto' : 'Adicionar foto'}
          inset={spacing.s16}
        />
      </Box>
      {busy ? <ActivityIndicator accessibilityLabel="Salvando foto" /> : null}
      <Text variant="title" textAlign="center" accessibilityRole="header">
        {fullName}
      </Text>
      {/* The athlete's cartel (selected modality, competitors only); opens the fight history. */}
      <MyFightRecordCard />
      {error ? (
        <Text variant="caption" color="danger" textAlign="center">
          {errorMessage(error)}
        </Text>
      ) : null}

      <PhotoCropper
        source={cropping?.uri ?? null}
        shape="circle"
        mirrored={cropping?.mirror ?? false}
        onCancel={() => setCropping(null)}
        onDone={cropped}
      />

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

/** The active academy (logo, name, role); opens Academias (switch, join another, leave). */
function AcademyRow() {
  const { active, memberships, pending } = useActiveGym();
  const others = activeMemberships(memberships).length - 1 + pending.length;
  if (!active) {
    return <ManageCard title="Academias" icon="home" onPress={() => router.push('/conta/academias')} />;
  }
  const label = membershipLabel(active);
  return (
    <Card
      onPress={() => router.push('/conta/academias')}
      accessibilityLabel={`${active.gymName}, ${label}. Ver academias`}
      flexDirection="row"
      alignItems="center"
      gap="s12"
    >
      <AcademyLogo name={active.gymName} url={active.gymLogoUrl} size="small" />
      <Box flex={1}>
        <Text variant="bodyStrong">{active.gymName}</Text>
        <Text variant="caption">{others > 0 ? `${label} · mais ${others}` : label}</Text>
      </Box>
      <Icon name="chevronRight" color="textMuted" />
    </Card>
  );
}

function ManageCard({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon: 'settings' | 'calendar' | 'belt' | 'user' | 'trophy' | 'drop' | 'share' | 'chart' | 'home' | 'money';
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
