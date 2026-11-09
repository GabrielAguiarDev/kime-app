import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { BottomSheet, Box, Button, Card, Icon, LoadError, Text, TextField } from '@components';
import { useAcademyToday, type Modality } from '@domain/Classes';
import {
  isEmptyPreviousRecord,
  parseRecordCount,
  PREVIOUS_RECORD_MAX,
  useCartel,
  usePreviousHistoryMutations,
  type ChampionshipResult,
  type PreviousRecord,
} from '@domain/Competition';
import type { GymMember } from '@domain/Membership';
import { errorMessage } from '@infra';
import { SheetForm } from '@screens/professor/shared';
import { useConfirm } from '@services/confirm';
import { haptics } from '@utils/haptics';

import { ChampionshipForm } from './ChampionshipForm';
import { BeforeKimiCard, ChampionshipResultRow } from './FightRecord';
import { RecordResultsContent } from './RecordResultsSheet';

type Sheet =
  | { kind: 'record'; modalityId: string }
  | { kind: 'create' }
  | { kind: 'championship'; championshipId: string; mode: 'results' | 'edit' };

const FIELDS = [
  ['wins', 'Vitórias'],
  ['losses', 'Derrotas'],
  ['draws', 'Empates'],
  ['gold', 'Ouro'],
  ['silver', 'Prata'],
  ['bronze', 'Bronze'],
] as const;
type Field = (typeof FIELDS)[number][0];

/**
 * Staff, competitor's page: "Histórico anterior" — fights from before the app.
 *  - Previous record per modality (numbers only): "Antes do Kimi" in the Cartel.
 *  - Previous championships: only in this athlete's history (never in the Início
 *    or the academy's list); placement and fights as in any championship.
 * Only staff create, edit and delete; the athlete only sees it in their Cartel.
 */
export function PreviousHistorySection({
  academyId,
  member,
  modalities,
}: {
  academyId: string;
  member: GymMember;
  modalities: Modality[];
}) {
  const cartel = useCartel(academyId, member.userId);
  const today = useAcademyToday(academyId);
  const mutations = usePreviousHistoryMutations(academyId, member.userId);
  const confirm = useConfirm();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const close = () => setSheet(null);

  const nameOf = (id: string) => modalities.find((m) => m.id === id)?.name ?? 'Modalidade removida';
  const competing = member.modalities.filter((l) => l.isCompetitor).map((l) => l.modalityId);
  const recordModalities = [...new Set([...competing, ...(cartel.previous ?? []).map((p) => p.modalityId)])];
  const recordOf = (modalityId: string) => cartel.previous?.find((p) => p.modalityId === modalityId);
  const previousChampionships = (cartel.history ?? []).filter((h) => h.isHistorical);
  const open = sheet?.kind === 'championship' ? previousChampionships.find((c) => c.championshipId === sheet.championshipId) : undefined;

  const remove = async (c: ChampionshipResult) => {
    close();
    const ok = await confirm({
      title: 'Apagar campeonato anterior?',
      message: `${c.name}, a colocação e as lutas registradas saem do cartel de ${member.fullName}.`,
      confirmLabel: 'Apagar',
      tone: 'danger',
    });
    if (ok) mutations.deleteChampionship.mutate(c.championshipId, { onSuccess: () => haptics.success() });
  };

  return (
    <Box gap="s12">
      <Text variant="captionCaps" accessibilityRole="header">
        Histórico anterior
      </Text>
      <Text variant="caption">
        Lutas de antes do Kimi. Somam no cartel do atleta, que só pode ver.
      </Text>
      {cartel.isLoading ? <ActivityIndicator accessibilityLabel="Carregando histórico anterior" /> : null}
      {cartel.isError ? <LoadError title="Não foi possível carregar o histórico anterior" onRetry={cartel.refetch} /> : null}

      {cartel.ready ? (
        <>
          <Box gap="s8">
            <Text variant="bodyStrong">Cartel anterior resumido</Text>
            {recordModalities.length === 0 ? (
              <Text variant="body" color="textMuted">
                O atleta não compete em nenhuma modalidade agora.
              </Text>
            ) : null}
            {recordModalities.map((modalityId) => {
              const record = recordOf(modalityId);
              const edit = () => setSheet({ kind: 'record', modalityId });
              return (
                <Box key={modalityId} gap="s4">
                  {recordModalities.length > 1 || record ? <Text variant="caption">{nameOf(modalityId)}</Text> : null}
                  {record ? (
                    <BeforeKimiCard record={record} onPress={edit} />
                  ) : (
                    <Card
                      onPress={edit}
                      accessibilityLabel={`Registrar cartel anterior de ${nameOf(modalityId)}`}
                      flexDirection="row"
                      alignItems="center"
                      gap="s12"
                    >
                      <Text variant="body" color="textMuted" flex={1}>
                        {`Registrar cartel anterior${recordModalities.length > 1 ? '' : ` de ${nameOf(modalityId)}`}`}
                      </Text>
                      <Icon name="plus" color="accent" />
                    </Card>
                  )}
                </Box>
              );
            })}
          </Box>

          <Box gap="s8">
            <Text variant="bodyStrong">Campeonatos anteriores</Text>
            {previousChampionships.length === 0 ? (
              <Text variant="body" color="textMuted">
                Nenhum campeonato anterior registrado.
              </Text>
            ) : null}
            {previousChampionships.map((c) => (
              <ChampionshipResultRow
                key={c.entryId}
                result={c}
                onPress={() => setSheet({ kind: 'championship', championshipId: c.championshipId, mode: 'results' })}
              />
            ))}
            <Button
              title="Adicionar campeonato anterior"
              variant="secondary"
              icon="plus"
              disabled={!today.data}
              onPress={() => setSheet({ kind: 'create' })}
            />
            {mutations.deleteChampionship.error ? (
              <Text variant="caption" color="danger">
                {errorMessage(mutations.deleteChampionship.error)}
              </Text>
            ) : null}
          </Box>
        </>
      ) : null}

      <BottomSheet visible={!!sheet && (sheet.kind !== 'championship' || !!open)} onRequestClose={close}>
        {sheet?.kind === 'record' ? (
          <PreviousRecordForm
            key={sheet.modalityId}
            modalityName={nameOf(sheet.modalityId)}
            initial={recordOf(sheet.modalityId)}
            saving={mutations.setRecord.isPending}
            error={mutations.setRecord.error}
            onSave={(values) =>
              mutations.setRecord.mutate(
                { modalityId: sheet.modalityId, ...values },
                {
                  onSuccess: () => {
                    haptics.success();
                    close();
                  },
                },
              )
            }
          />
        ) : null}

        {sheet?.kind === 'create' && today.data ? (
          <ChampionshipForm
            title="Campeonato anterior"
            pastBefore={today.data}
            modalities={modalities}
            saving={mutations.createChampionship.isPending}
            error={mutations.createChampionship.error}
            onSave={(input) =>
              mutations.createChampionship.mutate(input, {
                // Straight to placement and fights of the new championship.
                onSuccess: (id) => {
                  haptics.success();
                  setSheet({ kind: 'championship', championshipId: id, mode: 'results' });
                },
              })
            }
          />
        ) : null}

        {sheet?.kind === 'championship' && open ? (
          sheet.mode === 'edit' && today.data ? (
            <ChampionshipForm
              title="Editar campeonato anterior"
              pastBefore={today.data}
              initial={{ modalityId: open.modalityId, name: open.name, eventDate: open.eventDate, location: open.location }}
              modalities={modalities}
              saving={mutations.updateChampionship.isPending}
              error={mutations.updateChampionship.error}
              onSave={(input) =>
                mutations.updateChampionship.mutate(
                  { id: open.championshipId, input },
                  {
                    onSuccess: () => {
                      haptics.success();
                      setSheet({ ...sheet, mode: 'results' });
                    },
                  },
                )
              }
              onDelete={() => void remove(open)}
            />
          ) : (
            <RecordResultsContent
              entry={{ entryId: open.entryId, athleteId: member.userId, placement: open.placement, fights: open.fights }}
              title={open.name}
              headerAction={{
                icon: 'edit',
                accessibilityLabel: 'Editar campeonato anterior',
                onPress: () => setSheet({ ...sheet, mode: 'edit' }),
              }}
            />
          )
        ) : null}
      </BottomSheet>
    </Box>
  );
}

/** Sheet: the previous record of one modality, numbers only (all zeros removes it). */
function PreviousRecordForm({
  modalityName,
  initial,
  saving,
  error,
  onSave,
}: {
  modalityName: string;
  initial: PreviousRecord | undefined;
  saving: boolean;
  error: unknown;
  onSave: (values: Omit<PreviousRecord, 'modalityId'>) => void;
}) {
  const [text, setText] = useState<Record<Field, string>>(() => {
    const out = {} as Record<Field, string>;
    for (const [key] of FIELDS) out[key] = initial && initial[key] > 0 ? String(initial[key]) : '';
    return out;
  });
  const parsed = {} as Record<Field, number | null>;
  for (const [key] of FIELDS) parsed[key] = parseRecordCount(text[key]);
  const valid = FIELDS.every(([key]) => parsed[key] !== null);
  const values = parsed as Record<Field, number>;
  const clearing = valid && isEmptyPreviousRecord(values);

  const field = (key: Field, label: string) => (
    <Box key={key} flex={1}>
      <TextField
        label={label}
        value={text[key]}
        onChangeText={(t) => setText((prev) => ({ ...prev, [key]: t.replace(/\D/g, '') }))}
        placeholder="0"
        keyboardType="number-pad"
        maxLength={String(PREVIOUS_RECORD_MAX).length}
        errorMessage={parsed[key] === null ? 'Inválido' : undefined}
      />
    </Box>
  );

  return (
    <SheetForm
      title={`Antes do Kimi · ${modalityName}`}
      actions={
        <Button
          title={clearing && initial ? 'Remover cartel anterior' : 'Salvar'}
          variant={clearing && initial ? 'secondary' : 'primary'}
          disabled={!valid || (clearing && !initial)}
          loading={saving}
          onPress={() => valid && onSave(values)}
        />
      }
    >
      <Text variant="body" color="textMuted">
        Lutas e medalhas antes do Kimi, só os números. Somam no cartel do atleta.
      </Text>
      <Box gap="s8">
        <Text variant="captionCaps">Lutas</Text>
        <Box flexDirection="row" gap="s12">
          {FIELDS.slice(0, 3).map(([key, label]) => field(key, label))}
        </Box>
      </Box>
      <Box gap="s8">
        <Text variant="captionCaps">Medalhas</Text>
        <Box flexDirection="row" gap="s12">
          {FIELDS.slice(3).map(([key, label]) => field(key, label))}
        </Box>
      </Box>
      {error ? (
        <Text variant="caption" color="danger">
          {errorMessage(error)}
        </Text>
      ) : null}
    </SheetForm>
  );
}
