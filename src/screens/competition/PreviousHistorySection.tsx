import { useState } from 'react';
import { Alert } from 'react-native';

import { BottomSheet, Box, Button, Text, TextField } from '@components';
import { useAcademyToday, type Modality } from '@domain/Classes';
import {
  isEmptyPreviousRecord,
  parseRecordCount,
  previousMedals,
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
import type { CartelEditRequest } from './FightRecord';
import { RecordResultsContent } from './RecordResultsSheet';

/** What the Cartel screen asks to open (its "⋯" menu, or a tap on a previous item). */
type PreviousHistorySheet = CartelEditRequest;

/** Fights only: the medals come from them (previousMedals). */
const FIELDS = [
  ['wins', 'Vitórias'],
  ['losses', 'Derrotas'],
  ['draws', 'Empates'],
] as const;
type Field = (typeof FIELDS)[number][0];

/**
 * Staff, Cartel screen of an athlete: the sheets that edit the history before the app.
 *  - Previous record of the modality (numbers only): "Antes do Kimi" in the Cartel.
 *  - Previous championships: only in this athlete's history (never in the Início or the
 *    academy's list); placement and fights as in any championship.
 * The Cartel screen opens them (menu "⋯" and taps on the previous items of the history).
 * Only staff create, edit and delete; the athlete only sees it in their Cartel.
 */
export function PreviousHistoryEditor({
  academyId,
  member,
  modalities,
  modalityId,
  sheet,
  onSheetChange,
}: {
  academyId: string;
  member: GymMember;
  modalities: Modality[];
  /** Only this modality (the Cartel screen of one modality). */
  modalityId: string;
  sheet: PreviousHistorySheet | null;
  onSheetChange: (sheet: PreviousHistorySheet | null) => void;
}) {
  const cartel = useCartel(academyId, member.userId);
  const today = useAcademyToday(academyId);
  const mutations = usePreviousHistoryMutations(academyId, member.userId);
  const confirm = useConfirm();
  const setSheet = onSheetChange;
  const close = () => onSheetChange(null);

  const nameOf = (id: string) => modalities.find((m) => m.id === id)?.name ?? 'Modalidade removida';
  const formModalities = modalities.filter((m) => m.id === modalityId);
  const recordOf = (modalityId: string) => cartel.previous?.find((p) => p.modalityId === modalityId);
  const previousChampionships = (cartel.history ?? []).filter(
    (h) => h.isHistorical && h.modalityId === modalityId,
  );
  const open = sheet?.kind === 'championship' ? previousChampionships.find((c) => c.championshipId === sheet.championshipId) : undefined;

  const remove = async (c: ChampionshipResult) => {
    close();
    const ok = await confirm({
      title: 'Apagar campeonato anterior?',
      message: `${c.name}, a colocação e as lutas registradas saem do cartel de ${member.fullName}.`,
      confirmLabel: 'Apagar',
      tone: 'danger',
    });
    if (ok) {
      mutations.deleteChampionship.mutate(c.championshipId, {
        onSuccess: () => haptics.success(),
        onError: (e) => Alert.alert('Campeonato anterior', errorMessage(e)),
      });
    }
  };

  return (
    <>
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
            modalities={formModalities}
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
              initial={{ modalityId: open.modalityId, name: open.name, eventDate: open.eventDate, location: open.location, countsInRecord: open.countsInRecord }}
              modalities={formModalities}
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
    </>
  );
}

/** Sheet: the previous record of one modality, fights only; medals follow (all zeros removes it). */
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
  const tally = parsed as Record<Field, number>;
  const values = { ...tally, ...previousMedals(tally) };
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
        Lutas antes do Kimi, só os números. Somam no cartel do atleta.
      </Text>
      <Box gap="s8">
        <Text variant="captionCaps">Lutas</Text>
        <Box flexDirection="row" gap="s12">
          {FIELDS.map(([key, label]) => field(key, label))}
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
