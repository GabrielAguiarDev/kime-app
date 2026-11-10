import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import {
  Avatar,
  BeltChip,
  BigCounter,
  BottomSheet,
  Box,
  Button,
  Card,
  ChoiceRow,
  EmptyState,
  LoadError,
  ProgressBar,
  Screen,
  SelectionCard,
  Text,
  TextButton,
} from '@components';
import {
  beltName,
  beltProgress,
  beltsOf,
  trainedModalities,
  useAwardBelt,
  useBeltHistory,
  useBelts,
  useInstructorStats,
  useMemberStats,
  useModalities,
  useModalityStats,
  type Modality,
  type ModalityBelt,
  type ModalityStats,
} from '@domain/Classes';
import { membershipLabel, useGymMembers, useRemoveMembership, type GymMember } from '@domain/Membership';
import { errorMessage } from '@infra';
import { CompetitorSection } from '@screens/competition/CompetitorSection';
import { FightRecordSection } from '@screens/competition/FightRecord';
import { PreviousHistorySection } from '@screens/competition/PreviousHistorySection';
import { useActiveGym } from '@services/activeGym';
import { useConfirm } from '@services/confirm';
import { useSession } from '@services/session';
import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

import { BodyDataCard } from './BodyDataCard';
import { formatDate, SheetForm } from './shared';
import { StudentModalitiesSection } from './StudentModalitiesSection';

/**
 * Staff: one member of the academy.
 *  - owner / instructor: photo, name, role and classes taught (they do not train in the app);
 *  - student: body data (competitors), classes and belt progress per modality,
 *    competition team, record ("Cartel") and championships, history before the app
 *    ("Histórico anterior"), belt history, "Definir faixa".
 */
export function MemberDetailScreen() {
  const { membershipId } = useLocalSearchParams<{ membershipId: string }>();
  const { active } = useActiveGym();
  const members = useGymMembers(active?.gymId);

  // Always render the Screen (its ScrollView) on the first render: iOS only
  // places a scroll view under the large-title header when it is there as the
  // screen appears; mounted later it starts hidden under the header.
  if (!active || !membershipId) {
    return (
      <Screen nativeHeader title="Membro" onBack={() => router.back()}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }

  const member = members.data?.find((m) => m.id === membershipId);

  if (members.isError && !member) {
    return (
      <Screen nativeHeader title="Membro" onBack={() => router.back()}>
        <LoadError title="Não foi possível carregar o membro" onRetry={() => void members.refetch()} />
      </Screen>
    );
  }

  if (!members.isLoading && !member) {
    return (
      <Screen nativeHeader title="Membro" onBack={() => router.back()}>
        <EmptyState title="Membro não encontrado." description="Ele pode ter saído da academia." />
      </Screen>
    );
  }

  if (!member) {
    return (
      <Screen nativeHeader title=" " onBack={() => router.back()}>
        <ActivityIndicator />
      </Screen>
    );
  }

  if (member.role !== 'student') return <StaffMemberDetail academyId={active.gymId} member={member} />;
  return <StudentDetail academyId={active.gymId} member={member} />;
}

function MemberHeader({ member }: { member: GymMember }) {
  return (
    <Box alignItems="center" gap="s12">
      <Avatar name={member.fullName} path={member.avatarPath} size="large" competitor={member.isCompetitor} />
      {/* The name is the header title. */}
      <Text variant="captionCaps">{membershipLabel(member)}</Text>
    </Box>
  );
}

/** Owner / instructor: photo, role and the classes they taught (no check-ins, no belts). */
function StaffMemberDetail({ academyId, member }: { academyId: string; member: GymMember }) {
  const stats = useInstructorStats(academyId);
  const taught = stats.data?.find((s) => s.membershipId === member.id)?.classesTaught ?? 0;
  return (
    <Screen nativeHeader title={member.fullName} onBack={() => router.back()}>
      <Box gap="s24">
        <MemberHeader member={member} />
        {stats.isLoading ? <ActivityIndicator /> : null}
        {stats.data ? (
          <Card>
            <BigCounter value={taught} label="Aulas dadas" />
          </Card>
        ) : null}
        {stats.isError ? (
          <Text variant="caption" color="danger">
            {errorMessage(stats.error)}
          </Text>
        ) : null}
        <RemoveMemberSection member={member} />
      </Box>
    </Screen>
  );
}

function StudentDetail({ academyId, member }: { academyId: string; member: GymMember }) {
  const stats = useMemberStats(academyId);
  const modalityStats = useModalityStats(academyId);
  const modalities = useModalities(academyId);
  const belts = useBelts(academyId);
  const history = useBeltHistory(member.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const loading = stats.isLoading || modalityStats.isLoading || modalities.isLoading || belts.isLoading;
  const failed = [stats, modalityStats, modalities, belts].filter((q) => q.isError);
  const total = stats.data?.find((s) => s.membershipId === member.id)?.confirmedTotal ?? 0;
  const own = (modalityStats.data ?? []).filter((s) => s.membershipId === member.id);
  const allModalities = modalities.data ?? [];
  const trained = trainedModalities(allModalities, own);
  const selected = trained.find((m) => m.id === selectedId) ?? trained[0] ?? null;
  const withBelts = allModalities.filter((m) => m.usesBelts);
  const modalityName = (id: string) => allModalities.find((m) => m.id === id)?.name ?? 'Modalidade removida';

  return (
    <Screen nativeHeader
      title={member.fullName}
      onBack={() => router.back()}
      footer={withBelts.length > 0 ? <Button title="Definir faixa" onPress={() => setSheetOpen(true)} /> : undefined}
    >
      <Box gap="s24">
        <MemberHeader member={member} />
        {/* A competitor's cartel comes right after the name (user decision, 2026-11-10). */}
        {member.isCompetitor ? (
          <FightRecordSection
            academyId={academyId}
            athleteId={member.userId}
            modalities={allModalities}
            modalityIds={member.modalities.filter((l) => l.isCompetitor).map((l) => l.modalityId)}
            title="Cartel e campeonatos"
          />
        ) : null}
        <BodyDataCard userId={member.userId} />
        {loading ? <ActivityIndicator /> : null}
        {failed.length > 0 ? (
          <LoadError title="Não foi possível carregar as aulas" onRetry={() => failed.forEach((q) => void q.refetch())} />
        ) : null}

        <Card>
          <BigCounter value={total} label="Aulas confirmadas · todas as modalidades" />
        </Card>
        <Button
          title="Relatório de treinos"
          variant="secondary"
          icon="chart"
          onPress={() => router.push({ pathname: '/relatorio', params: { userId: member.userId, name: member.fullName } })}
        />

        {trained.length > 1 && selected ? (
          <ChoiceRow
            accessibilityLabel="Modalidade"
            options={trained.map((m) => ({ value: m.id, label: m.name }))}
            value={selected.id}
            onChange={setSelectedId}
          />
        ) : null}

        {selected ? (
          <ModalityCard
            modality={selected}
            belts={beltsOf(belts.data ?? [], selected.id)}
            stats={own.find((s) => s.modalityId === selected.id)}
          />
        ) : null}

        <StudentModalitiesSection member={member} modalities={allModalities} />

        <CompetitorSection member={member} modalities={allModalities} />

        {member.isCompetitor ? (
          <PreviousHistorySection academyId={academyId} member={member} modalities={allModalities} />
        ) : null}

        <Box gap="s12">
          <Text variant="captionCaps">Histórico de faixas</Text>
          {history.isLoading ? <ActivityIndicator /> : null}
          {history.data?.length === 0 ? (
            <Text variant="body" color="textMuted">
              Nenhuma graduação registrada.
            </Text>
          ) : null}
          {history.data?.map((award) => (
            <Card key={award.id} flexDirection="row" alignItems="center" justifyContent="space-between" gap="s12">
              <Box gap="s4" flex={1}>
                <BeltChip belt={award.belt} />
                <Text variant="caption">{modalityName(award.modalityId)}</Text>
              </Box>
              <Text variant="caption">{formatDate(award.awardedAt)}</Text>
            </Card>
          ))}
        </Box>

        <RemoveMemberSection member={member} />
      </Box>

      <BottomSheet visible={sheetOpen} onRequestClose={() => setSheetOpen(false)}>
        <AwardForm
          academyId={academyId}
          membershipId={member.id}
          modalities={withBelts}
          initialModalityId={selected?.usesBelts ? selected.id : (withBelts[0]?.id ?? null)}
          belts={belts.data ?? []}
          stats={own}
          onDone={() => setSheetOpen(false)}
        />
      </BottomSheet>
    </Screen>
  );
}

function ModalityCard({
  modality,
  belts,
  stats,
}: {
  modality: Modality;
  belts: ModalityBelt[];
  stats: ModalityStats | undefined;
}) {
  const modalityTotal = stats?.confirmedTotal ?? 0;
  if (!modality.usesBelts) {
    return (
      <Card>
        <BigCounter value={modalityTotal} label={`Aulas de ${modality.name}`} />
      </Card>
    );
  }
  const current = belts.find((b) => b.id === stats?.beltId) ?? null;
  const progress = beltProgress(belts, current?.id ?? null, stats?.confirmedSinceBelt ?? 0);
  return (
    <Card gap="s16">
      {current ? <BeltChip belt={current} /> : <Text variant="caption">{`Sem faixa em ${modality.name}`}</Text>}
      {progress.next && progress.required > 0 ? (
        <ProgressBar
          value={progress.done}
          max={progress.required}
          unit="aulas"
          beltColor={progress.next.primary}
          label={`Até a faixa ${beltName(progress.next).toLowerCase()}`}
        />
      ) : (
        <Text variant="body" color="textMuted">
          {progress.next
            ? 'A próxima faixa ainda não tem o número de aulas definido.'
            : belts.length
              ? 'Já está na última faixa desta modalidade.'
              : 'Esta modalidade ainda não tem faixas cadastradas.'}
        </Text>
      )}
      <BigCounter value={modalityTotal} label={`Aulas de ${modality.name}`} />
    </Card>
  );
}

function AwardForm({
  academyId,
  membershipId,
  modalities,
  initialModalityId,
  belts,
  stats,
  onDone,
}: {
  academyId: string;
  membershipId: string;
  modalities: Modality[];
  initialModalityId: string | null;
  belts: ModalityBelt[];
  stats: ModalityStats[];
  onDone: () => void;
}) {
  const award = useAwardBelt(academyId, membershipId);
  const [modalityId, setModalityId] = useState<string | null>(initialModalityId);
  const [beltId, setBeltId] = useState<string | null>(null);
  const options = modalityId ? beltsOf(belts, modalityId) : [];
  const current = stats.find((s) => s.modalityId === modalityId)?.beltId ?? null;

  return (
    <SheetForm
      title="Definir faixa"
      actions={
        <Button
          title="Salvar faixa"
          disabled={!beltId || beltId === current}
          loading={award.isPending}
          onPress={() =>
            beltId &&
            award.mutate(beltId, {
              onSuccess: () => {
                haptics.success();
                onDone();
              },
            })
          }
        />
      }
    >
      {modalities.length > 1 && modalityId ? (
        <ChoiceRow
          accessibilityLabel="Modalidade"
          options={modalities.map((m) => ({ value: m.id, label: m.name }))}
          value={modalityId}
          onChange={(id) => {
            setModalityId(id);
            setBeltId(null);
          }}
        />
      ) : null}
      <Text variant="body" color="textMuted">
        A contagem para a próxima faixa desta modalidade recomeça: contam as aulas a partir de amanhã.
      </Text>
      {options.length === 0 ? (
        <Text variant="body" color="textMuted">
          O proprietário ainda não cadastrou as faixas desta modalidade.
        </Text>
      ) : null}
      {options.map((b) => (
        <SelectionCard
          key={b.id}
          label={beltName(b)}
          description={b.id === current ? 'Faixa atual' : undefined}
          leading={<BeltChip belt={b} label="" />}
          selected={beltId === b.id}
          onPress={() => setBeltId(b.id)}
        />
      ))}
      {award.error ? (
        <Text variant="caption" color="danger">
          {errorMessage(award.error)}
        </Text>
      ) : null}
    </SheetForm>
  );
}

/**
 * "Remover da academia", at the end in its own area (owner only; never the
 * owner nor yourself). The list in Equipe has no remove button.
 */
function RemoveMemberSection({ member }: { member: GymMember }) {
  const { isOwner } = useActiveGym();
  const { userId } = useSession();
  const remove = useRemoveMembership();
  const confirm = useConfirm();
  const { border } = useAppTheme();
  if (!isOwner || member.role === 'owner' || member.userId === userId) return null;

  const ask = async () => {
    const ok = await confirm({
      title: 'Remover da academia?',
      message: `${member.fullName} perde o acesso à academia. O histórico de aulas fica guardado.`,
      confirmLabel: 'Remover',
      tone: 'danger',
    });
    if (!ok) return;
    remove.mutate(member.id, {
      onSuccess: () => router.back(),
      onError: (e) => Alert.alert('Remover', errorMessage(e)),
    });
  };

  return (
    <Box gap="s12" marginTop="s24" paddingTop="s24" borderTopWidth={border.width} borderColor="border">
      <Text variant="captionCaps">Ações sensíveis</Text>
      <TextButton title="Remover da academia" color="danger" disabled={remove.isPending} onPress={ask} />
    </Box>
  );
}
