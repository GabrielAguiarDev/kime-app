import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import {
  Avatar,
  BeltSwatch,
  Box,
  Button,
  Card,
  EmptyState,
  HeaderButton,
  Icon,
  LoadError,
  Screen,
  Text,
  TextButton,
} from '@components';
import {
  beltName,
  daysBetweenLabel,
  nextClass,
  nowTimeIn,
  useAcademyToday,
  useBelts,
  useModalities,
  type Modality,
  type ModalityBelt,
} from '@domain/Classes';
import {
  asClassSchedules,
  teachingGroups,
  useInstructorProfile,
  useSetInstructorModalities,
  type InstructorProfile,
  type TeachingGroup,
} from '@domain/Instructor';
import { roleLabel, useGymMembers, useTransferOwnership } from '@domain/Membership';
import { memberSinceLabel } from '@domain/Team';
import { errorMessage } from '@infra';
import { RemoveMemberSection } from '@screens/professor/RemoveMemberSection';
import { WeekdayChips } from '@screens/professor/WeekdayChips';
import { ACADEMY_TIME_ZONE } from '@screens/student/home/NextClassCard';
import { ModalitiesSheet } from '@screens/staff/ModalitiesSheet';
import { useActiveGym } from '@services/activeGym';
import { useConfirm } from '@services/confirm';
import { useSession } from '@services/session';
import { haptics } from '@utils/haptics';

import type { ProfileView } from './profileView';
import { InstructorBeltSheet } from './InstructorBeltSheet';

/**
 * Owner / instructor profile, the same screen for everyone in the academy
 * (staff from Equipe, students from their Equipe, the person on their own
 * card): photo, role, bio, belts per modality, the classes they give (next
 * one in accent), since when and, for the owner looking at an instructor,
 * the management actions.
 */
export function InstructorProfileScreen({ academyId, userId, onBack }: { academyId: string; userId: string; onBack: () => void }) {
  const profile = useInstructorProfile(academyId, userId);
  const modalities = useModalities(academyId);
  const belts = useBelts(academyId);
  const today = useAcademyToday(academyId);
  const { userId: me } = useSession();
  const own = userId === me;

  if (profile.isLoading) {
    return (
      <Screen nativeHeader title="" largeTitle={false} onBack={onBack}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if (profile.isError) {
    return (
      <Screen nativeHeader title="" largeTitle={false} onBack={onBack}>
        <LoadError title="Não foi possível carregar o perfil" onRetry={() => void profile.refetch()} />
      </Screen>
    );
  }
  if (!profile.data) {
    return (
      <Screen nativeHeader title="" largeTitle={false} onBack={onBack}>
        <EmptyState title="Professor não encontrado." description="Ele pode ter saído da academia." />
      </Screen>
    );
  }

  const data = profile.data;
  const allModalities = modalities.data ?? [];
  const view = buildView(academyId, data, allModalities, belts.data ?? [], today.data);

  return (
    <Screen
      nativeHeader
      title=""
      largeTitle={false}
      onBack={onBack}
      // Since when: at the end of the scroll, like a footer (same as the student's profile).
      endFooter={
        <Text variant="caption" textAlign="center">
          {`Na academia desde ${memberSinceLabel(view.memberSince)}`}
        </Text>
      }
      headerRight={
        own ? <HeaderButton icon="edit" accessibilityLabel="Editar perfil" onPress={() => router.push('/editar-perfil')} /> : undefined
      }
    >
      <Box gap="s32">
        {/* Top like the student's profile: photo, name under it ("Proprietário" for the owner); the bio close under them. */}
        <Box gap="s16">
          <Box alignItems="center" gap="s12">
            <Avatar name={data.fullName} path={data.avatarPath} size="large" expandable />
            <Text variant="title" textAlign="center" accessibilityRole="header">
              {own ? `${data.fullName} (você)` : data.fullName}
            </Text>
            {/* Only the owner is labeled (an instructor has no role line). */}
            {data.role === 'owner' ? (
              <Text variant="body" color="textMuted">
                {roleLabel.owner}
              </Text>
            ) : null}
          </Box>

          {view.bio ? (
            // A bit smaller than body (16) and centered under the top, set apart from the other text.
            <Text variant="body" fontSize={14} lineHeight={20} textAlign="center">
              {view.bio}
            </Text>
          ) : own ? (
            <Button title="Adicionar bio" variant="ghost" icon="plus" onPress={() => router.push('/editar-perfil')} />
          ) : null}
        </Box>

        {view.belts.length > 0 ? (
          <Card gap="s12">
            {view.belts.map(({ modality, belt }) => (
              <Box
                key={modality.id}
                flexDirection="row"
                alignItems="center"
                gap="s12"
                accessible
                accessibilityLabel={`${modality.name}: faixa ${beltName(belt)}`}
              >
                <BeltSwatch belt={belt} width={44} height={16} />
                <Text variant="bodyStrong" flex={1} numberOfLines={1}>
                  {modality.name}
                </Text>
                <Text variant="caption" numberOfLines={1} flexShrink={1}>
                  {beltName(belt)}
                </Text>
              </Box>
            ))}
          </Card>
        ) : null}

        {view.groups.length > 0 ? <ClassesSection groups={view.groups} next={view.next} /> : null}

        <OwnerActions academyId={academyId} profile={data} modalities={allModalities} />
      </Box>
    </Screen>
  );
}

function buildView(
  academyId: string,
  data: InstructorProfile,
  modalities: Modality[],
  belts: ModalityBelt[],
  today: string | undefined,
): ProfileView {
  const beltRows = modalities.flatMap((modality) => {
    if (!modality.usesBelts) return [];
    const id = data.belts.find((b) => b.modalityId === modality.id)?.beltId;
    const belt = belts.find((b) => b.id === id);
    return belt ? [{ modality, belt: { primary: belt.primary, tip: belt.tip } }] : [];
  });
  const found = today ? nextClass(asClassSchedules(academyId, data.userId, data.schedules, modalities), today, nowTimeIn(ACADEMY_TIME_ZONE)) : null;
  return {
    bio: data.bio,
    belts: beltRows,
    memberSince: data.memberSince,
    groups: teachingGroups(data.schedules, modalities),
    next: found && today
      ? {
          scheduleId: found.schedule.id,
          label: found.status === 'live' ? 'Em andamento' : `Próxima · ${daysBetweenLabel(today, found.date)}`,
        }
      : null,
  };
}

/** "Aulas que dá": one card per modality, one row per time with its weekdays; the next class in accent. */
function ClassesSection({ groups, next }: { groups: TeachingGroup[]; next: ProfileView['next'] }) {
  return (
    <Box gap="s12">
      <Text variant="captionCaps">Aulas que dá</Text>
      {groups.map((group) => (
        <Card key={group.modality.id} gap="s16">
          <Text variant="bodyStrong" numberOfLines={1}>
            {group.modality.name}
          </Text>
          {group.slots.map((slot) => {
            const isNext = !!next && slot.scheduleIds.includes(next.scheduleId);
            return (
              <Box key={slot.startTime} gap="s8">
                <Box flexDirection="row" alignItems="center" gap="s12">
                  <Text variant="counter" color={isNext ? 'accent' : 'text'}>
                    {slot.startTime}
                  </Text>
                  {isNext ? (
                    <Text variant="caption" color="accent">
                      {next.label}
                    </Text>
                  ) : null}
                </Box>
                <WeekdayChips days={slot.days} muted={!isNext} />
              </Box>
            );
          })}
        </Card>
      ))}
    </Box>
  );
}

/**
 * Owner looking at an instructor: modalities, belt, transfer the academy and
 * remove (danger). Never on the owner's own profile.
 */
function OwnerActions({ academyId, profile, modalities }: { academyId: string; profile: InstructorProfile; modalities: Modality[] }) {
  const { isOwner, active } = useActiveGym();
  const { userId: me } = useSession();
  const members = useGymMembers(isOwner ? academyId : undefined);
  const belts = useBelts(academyId);
  const setModalities = useSetInstructorModalities(academyId, profile.membershipId);
  const transfer = useTransferOwnership(academyId);
  const confirm = useConfirm();
  const [sheet, setSheet] = useState<'modalities' | 'belt' | null>(null);
  if (!isOwner || profile.userId === me || profile.role !== 'instructor') return null;

  const member = members.data?.find((m) => m.id === profile.membershipId);
  const withBelts = modalities.filter((m) => m.usesBelts);
  const names = modalities.filter((m) => profile.modalityIds.includes(m.id)).map((m) => m.name);

  const askTransfer = async () => {
    const ok = await confirm({
      title: `Transferir ${active?.gymName ?? 'a academia'}?`,
      message: `${profile.fullName} passa a ser o proprietário: configurações, códigos, professores e remoção de membros. Você continua na academia como professor e não pode desfazer isso sozinho.`,
      confirmLabel: 'Transferir academia',
      tone: 'danger',
    });
    if (!ok) return;
    transfer.mutate(profile.membershipId, {
      onSuccess: () => {
        haptics.success();
        router.back();
      },
      onError: (e) => Alert.alert('Transferir academia', errorMessage(e)),
    });
  };

  return (
    <Box gap="s12">
      <Text variant="captionCaps">Gerenciar professor</Text>
      <Card flexDirection="row" alignItems="center" gap="s12" onPress={() => setSheet('modalities')} accessibilityLabel="Editar modalidades">
        <Box flex={1} gap="s4">
          <Text variant="bodyStrong">Modalidades</Text>
          <Text variant="caption">{names.length ? names.join(', ') : 'Nenhuma'}</Text>
        </Box>
        <Icon name="chevronRight" color="textMuted" />
      </Card>
      {withBelts.length > 0 ? (
        <Card flexDirection="row" alignItems="center" gap="s12" onPress={() => setSheet('belt')} accessibilityLabel="Editar faixa">
          <Text variant="bodyStrong" flex={1}>
            Faixa
          </Text>
          <Icon name="chevronRight" color="textMuted" />
        </Card>
      ) : null}
      {setModalities.error ? (
        <Text variant="caption" color="danger">
          {errorMessage(setModalities.error)}
        </Text>
      ) : null}

      {member ? (
        <RemoveMemberSection member={member}>
          <TextButton title="Transferir academia" color="danger" disabled={transfer.isPending} onPress={() => void askTransfer()} />
        </RemoveMemberSection>
      ) : null}

      <ModalitiesSheet
        visible={sheet === 'modalities'}
        title="Modalidades do professor"
        modalities={modalities}
        initial={profile.modalityIds}
        confirmLabel="Salvar"
        allowEmpty
        loading={setModalities.isPending}
        onConfirm={(ids) =>
          setModalities.mutate(ids, {
            onSuccess: () => {
              haptics.success();
              setSheet(null);
            },
          })
        }
        onClose={() => setSheet(null)}
      />
      <InstructorBeltSheet
        visible={sheet === 'belt'}
        academyId={academyId}
        membershipId={profile.membershipId}
        modalities={withBelts}
        belts={belts.data ?? []}
        current={profile.belts}
        initialModalityId={null}
        onClose={() => setSheet(null)}
      />
    </Box>
  );
}
