import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

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
  Icon,
  LoadError,
  NativeMenu,
  ProgressBar,
  Screen,
  SelectionCard,
  Text,
} from '@components';
import {
  beltName,
  beltProgress,
  beltsOf,
  trainedModalities,
  useAwardBelt,
  useBeltHistory,
  useBelts,
  useModalities,
  useModalityStats,
  type Modality,
  type ModalityBelt,
  type ModalityStats,
} from '@domain/Classes';
import { membershipLabel, useGymMembers, type GymMember } from '@domain/Membership';
import { errorMessage } from '@infra';
import { CompetitorSection } from '@screens/competition/CompetitorSection';
import { FightRecordSection } from '@screens/competition/FightRecord';
import { StudentBillingSection } from '@screens/finance/StudentBillingSection';
import { InstructorProfileScreen } from '@screens/instructor/InstructorProfileScreen';
import { ReadyBadge } from '@screens/staff/ReadyBadge';
import { useActiveGym } from '@services/activeGym';
import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

import { BodyDataCard } from './BodyDataCard';
import { RemoveMemberSection } from './RemoveMemberSection';
import { formatDate, SheetForm } from './shared';
import { StudentModalitiesSection } from './StudentModalitiesSection';

/**
 * Staff: one member of the academy.
 *  - owner / instructor: the instructor profile (InstructorProfileScreen, same for everyone);
 *  - student: body data (competitors), classes and belt progress per modality,
 *    competition team, record ("Cartel": tapping it opens the Cartel screen, where staff also
 *    edit the history before the app), belt history, "Definir faixa".
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

  if (member.role !== 'student') {
    return <InstructorProfileScreen academyId={active.gymId} userId={member.userId} onBack={() => router.back()} />;
  }
  return <StudentDetail academyId={active.gymId} member={member} />;
}

function MemberHeader({ member }: { member: GymMember }) {
  return (
    <Box alignItems="center" gap="s12">
      <Avatar name={member.fullName} path={member.avatarPath} size="large" competitor={member.isCompetitor} expandable />
      {/* The name is the header title. */}
      <Text variant="captionCaps">{membershipLabel(member)}</Text>
    </Box>
  );
}

function StudentDetail({ academyId, member }: { academyId: string; member: GymMember }) {
  const { isOwner } = useActiveGym();
  const modalityStats = useModalityStats(academyId);
  const modalities = useModalities(academyId);
  const belts = useBelts(academyId);
  const history = useBeltHistory(member.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loading = modalityStats.isLoading || modalities.isLoading || belts.isLoading;
  const failed = [modalityStats, modalities, belts].filter((q) => q.isError);
  const own = (modalityStats.data ?? []).filter((s) => s.membershipId === member.id);
  const allModalities = modalities.data ?? [];
  const trained = trainedModalities(allModalities, own);
  const selected = trained.find((m) => m.id === selectedId) ?? trained[0] ?? null;
  const withBelts = allModalities.filter((m) => m.usesBelts);

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
            athleteName={member.fullName}
            title="Cartel"
          />
        ) : null}
        <BodyDataCard userId={member.userId} />
        {loading ? <ActivityIndicator /> : null}
        {failed.length > 0 ? (
          <LoadError title="Não foi possível carregar as aulas" onRetry={() => failed.forEach((q) => void q.refetch())} />
        ) : null}

        <Button
          title="Relatório de treinos"
          variant="secondary"
          icon="chart"
          onPress={() => router.push({ pathname: '/relatorio', params: { userId: member.userId, name: member.fullName } })}
        />

        {selected ? (
          <ModalityCard
            modality={selected}
            modalities={trained}
            onSelect={setSelectedId}
            belts={beltsOf(belts.data ?? [], selected.id)}
            stats={own.find((s) => s.modalityId === selected.id)}
            linked={member.modalities.some((l) => l.modalityId === selected.id)}
            onPress={selected.usesBelts ? () => setHistoryOpen(true) : undefined}
          />
        ) : null}

        <StudentModalitiesSection member={member} modalities={allModalities} />

        <CompetitorSection member={member} modalities={allModalities} />

        {/* Owner only (finance on): monthly fee and charge history. */}
        {isOwner ? <StudentBillingSection academyId={academyId} member={member} /> : null}

        <RemoveMemberSection member={member} />
      </Box>

      {/* Belt history of the modality on the card (tapping the card opens it). */}
      <BottomSheet visible={historyOpen && !!selected} onRequestClose={() => setHistoryOpen(false)}>
        {selected ? (
          <SheetForm title={`Histórico de faixas · ${selected.name}`}>
            {history.isLoading ? <ActivityIndicator /> : null}
            {history.isError ? <LoadError title="Não foi possível carregar o histórico" onRetry={() => void history.refetch()} /> : null}
            {history.data && !history.data.some((a) => a.modalityId === selected.id) ? (
              <Text variant="body" color="textMuted">
                Nenhuma graduação registrada.
              </Text>
            ) : null}
            {history.data
              ?.filter((award) => award.modalityId === selected.id)
              .map((award) => (
                <Card key={award.id} flexDirection="row" alignItems="center" justifyContent="space-between" gap="s12">
                  <BeltChip belt={award.belt} />
                  <Text variant="caption">{formatDate(award.awardedAt)}</Text>
                </Card>
              ))}
          </SheetForm>
        ) : null}
      </BottomSheet>

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

/**
 * Card title: the modality name. More than one trained modality: name + caret opening the
 * native menu (same pattern as the Início header), so long names and many modalities fit.
 */
function ModalityPicker({
  modality,
  modalities,
  onSelect,
}: {
  modality: Modality;
  modalities: Modality[];
  onSelect: (id: string) => void;
}) {
  const { size } = useAppTheme();
  const title = (
    <Text variant="bodyStrong" numberOfLines={1} flexShrink={1}>
      {modality.name}
    </Text>
  );
  if (modalities.length < 2) return title;
  return (
    <NativeMenu
      accessibilityLabel={`Modalidade: ${modality.name}. Trocar`}
      label={
        <Box flexDirection="row" alignItems="center" gap="s8" alignSelf="flex-start">
          {title}
          <Icon name="chevronDown" color="textMuted" size={size.iconInline} />
        </Box>
      }
      options={modalities.map((m) => ({ id: m.id, title: m.name }))}
      selectedId={modality.id}
      onSelect={onSelect}
      // Build without the native menu: each tap moves to the next modality.
      onFallbackPress={() => {
        const i = modalities.findIndex((m) => m.id === modality.id);
        const next = modalities[(i + 1) % modalities.length];
        if (next) onSelect(next.id);
      }}
    />
  );
}

function ModalityCard({
  modality,
  modalities,
  onSelect,
  belts,
  stats,
  linked,
  onPress,
}: {
  modality: Modality;
  modalities: Modality[];
  onSelect: (id: string) => void;
  belts: ModalityBelt[];
  stats: ModalityStats | undefined;
  /** Active link to the modality: the "Pronto para graduar" seal follows the same rule as the list (readyToGraduate). */
  linked: boolean;
  /** Opens the belt history of the modality. */
  onPress?: () => void;
}) {
  const modalityTotal = stats?.confirmedTotal ?? 0;
  const picker = <ModalityPicker modality={modality} modalities={modalities} onSelect={onSelect} />;
  if (!modality.usesBelts) {
    return (
      <Card gap="s16">
        {picker}
        <BigCounter value={modalityTotal} label={`Aulas de ${modality.name}`} />
      </Card>
    );
  }
  const current = belts.find((b) => b.id === stats?.beltId) ?? null;
  const progress = beltProgress(belts, current?.id ?? null, stats?.confirmedSinceBelt ?? 0);
  return (
    <Card gap="s16" onPress={onPress} accessibilityLabel={`${modality.name}. Ver histórico de faixas`}>
      <Box flexDirection="row" alignItems="center" gap="s12">
        <Box flex={1} alignItems="flex-start">
          {picker}
        </Box>
        {onPress ? <Icon name="chevronRight" color="textMuted" size={20} /> : null}
      </Box>
      {current ? <BeltChip belt={current} /> : <Text variant="caption">Sem faixa</Text>}
      {linked && progress.next && progress.required > 0 && (stats?.confirmedSinceBelt ?? 0) >= progress.required ? <ReadyBadge /> : null}
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
