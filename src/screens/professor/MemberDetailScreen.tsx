import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import {
  BELTS,
  BeltChip,
  BigCounter,
  BottomSheet,
  Box,
  Button,
  Card,
  EmptyState,
  ProgressBar,
  Screen,
  SelectionCard,
  Text,
  type Belt,
} from '@components';
import { beltProgress, useAwardBelt, useBeltGoals, useBeltHistory, useMemberStats } from '@domain/Classes';
import { membershipLabel, useGymMembers } from '@domain/Membership';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { haptics } from '@utils/haptics';

import { formatDate, SheetForm, toBelt } from './shared';

/** Professor: one member's classes, belt progress and belt history; awards belts. */
export function MemberDetailScreen() {
  const { membershipId } = useLocalSearchParams<{ membershipId: string }>();
  const { active } = useActiveGym();
  const members = useGymMembers(active?.gymId);
  const stats = useMemberStats(active?.gymId);
  const goals = useBeltGoals(active?.gymId);
  const history = useBeltHistory(membershipId);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!active || !membershipId) return null;

  const member = members.data?.find((m) => m.id === membershipId);
  const memberStats = stats.data?.find((s) => s.membershipId === membershipId);
  const belt = toBelt(memberStats?.belt ?? member?.belt);
  const loading = members.isLoading || stats.isLoading || goals.isLoading;

  if (!loading && !member) {
    return (
      <Screen onBack={() => router.back()}>
        <EmptyState title="Membro não encontrado." description="Ele pode ter saído da academia." />
      </Screen>
    );
  }

  const progress = beltProgress(goals.data ?? [], belt, memberStats?.confirmedSinceBelt ?? 0);

  return (
    <Screen
      title={member?.fullName ?? ' '}
      onBack={() => router.back()}
      footer={<Button title="Definir faixa" onPress={() => setSheetOpen(true)} disabled={!member} />}
    >
      {loading ? <ActivityIndicator /> : null}
      {member ? (
        <Box gap="s24">
          <Box gap="s8">
            <Text variant="captionCaps">{membershipLabel(member)}</Text>
            {belt ? <BeltChip belt={belt} /> : <Text variant="caption">Sem faixa</Text>}
          </Box>

          <Card>
            <BigCounter value={memberStats?.confirmedTotal ?? 0} label="Aulas confirmadas" />
          </Card>

          <Card gap="s12">
            {progress.next ? (
              <ProgressBar
                value={progress.done}
                max={progress.required}
                unit="aulas"
                color={BELTS[progress.next.belt].color}
                label={`Até a faixa ${BELTS[progress.next.belt].label.toLowerCase()}`}
              />
            ) : (
              <Text variant="body" color="textMuted">
                {goals.data?.length
                  ? 'Já está na última faixa da academia.'
                  : 'Cadastre as metas de faixa para acompanhar a graduação.'}
              </Text>
            )}
            {goals.data?.length === 0 ? (
              <Button title="Metas de faixa" variant="secondary" onPress={() => router.push('/academy/belts')} />
            ) : null}
          </Card>

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
                <BeltChip belt={award.belt} />
                <Text variant="caption">{formatDate(award.awardedAt)}</Text>
              </Card>
            ))}
          </Box>
        </Box>
      ) : null}

      <BottomSheet visible={sheetOpen} onRequestClose={() => setSheetOpen(false)}>
        {member ? (
          <AwardForm
            academyId={active.gymId}
            membershipId={membershipId}
            current={belt}
            options={goals.data?.length ? goals.data.map((g) => g.belt) : (Object.keys(BELTS) as Belt[])}
            onDone={() => setSheetOpen(false)}
          />
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

function AwardForm({
  academyId,
  membershipId,
  current,
  options,
  onDone,
}: {
  academyId: string;
  membershipId: string;
  current: Belt | null;
  options: Belt[];
  onDone: () => void;
}) {
  const award = useAwardBelt(academyId, membershipId);
  const [belt, setBelt] = useState<Belt | null>(null);

  return (
    <SheetForm
      title="Definir faixa"
      actions={
        <>
          <Button
            title="Salvar faixa"
            disabled={!belt || belt === current}
            loading={award.isPending}
            onPress={() =>
              belt &&
              award.mutate(belt, {
                onSuccess: () => {
                  haptics.success();
                  onDone();
                },
              })
            }
          />
        </>
      }
    >
      <Text variant="body" color="textMuted">
        A contagem para a próxima faixa recomeça a partir de hoje.
      </Text>
      {options.map((b) => (
        <SelectionCard
          key={b}
          label={BELTS[b].label}
          description={b === current ? 'Faixa atual' : undefined}
          leading={<BeltChip belt={b} label="" />}
          selected={belt === b}
          onPress={() => setBelt(b)}
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
