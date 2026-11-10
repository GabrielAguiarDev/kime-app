import { useState } from 'react';

import { BeltChip, BottomSheet, Button, ChoiceRow, SelectionCard, Text } from '@components';
import { beltName, beltsOf, type Modality, type ModalityBelt } from '@domain/Classes';
import { useSetInstructorBelt, type InstructorBelt } from '@domain/Instructor';
import { errorMessage } from '@infra';
import { SheetForm } from '@screens/professor/shared';
import { haptics } from '@utils/haptics';

/**
 * The staff member's own belt in a modality (the person, or the owner for any
 * staff member): the academy's belt sequence of the modality, or "Sem faixa".
 * Only modalities that use belts. Mount it only while visible so it starts
 * from `initialModalityId` every time.
 */
export function InstructorBeltSheet({
  visible,
  academyId,
  membershipId,
  modalities,
  belts,
  current,
  initialModalityId,
  onClose,
}: {
  visible: boolean;
  academyId: string;
  membershipId: string;
  /** Modalities with belts. */
  modalities: Modality[];
  belts: ModalityBelt[];
  current: InstructorBelt[];
  initialModalityId: string | null;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} onRequestClose={onClose}>
      {visible ? (
        <BeltForm
          academyId={academyId}
          membershipId={membershipId}
          modalities={modalities}
          belts={belts}
          current={current}
          initialModalityId={initialModalityId ?? modalities[0]?.id ?? null}
          onDone={onClose}
        />
      ) : null}
    </BottomSheet>
  );
}

function BeltForm({
  academyId,
  membershipId,
  modalities,
  belts,
  current,
  initialModalityId,
  onDone,
}: {
  academyId: string;
  membershipId: string;
  modalities: Modality[];
  belts: ModalityBelt[];
  current: InstructorBelt[];
  initialModalityId: string | null;
  onDone: () => void;
}) {
  const save = useSetInstructorBelt(academyId, membershipId);
  const [modalityId, setModalityId] = useState(initialModalityId);
  const currentOf = (id: string | null) => current.find((b) => b.modalityId === id)?.beltId ?? null;
  const [beltId, setBeltId] = useState<string | null>(currentOf(initialModalityId));
  const options = modalityId ? beltsOf(belts, modalityId) : [];
  const unchanged = beltId === currentOf(modalityId);

  return (
    <SheetForm
      title="Faixa do professor"
      tall
      actions={
        <Button
          title="Salvar faixa"
          disabled={!modalityId || unchanged}
          loading={save.isPending}
          onPress={() =>
            modalityId &&
            save.mutate(
              { modalityId, beltId },
              {
                onSuccess: () => {
                  haptics.success();
                  onDone();
                },
              },
            )
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
            setBeltId(currentOf(id));
          }}
        />
      ) : null}
      {modalities.length === 0 ? (
        <Text variant="body" color="textMuted">
          Nenhuma modalidade da academia usa faixas.
        </Text>
      ) : null}
      {modalityId && options.length === 0 ? (
        <Text variant="body" color="textMuted">
          O proprietário ainda não cadastrou as faixas desta modalidade.
        </Text>
      ) : null}
      {modalityId ? (
        <SelectionCard
          label="Sem faixa"
          description={currentOf(modalityId) === null ? 'Atual' : undefined}
          selected={beltId === null}
          onPress={() => setBeltId(null)}
        />
      ) : null}
      {options.map((b) => (
        <SelectionCard
          key={b.id}
          label={beltName(b)}
          description={b.id === currentOf(modalityId) ? 'Atual' : undefined}
          leading={<BeltChip belt={b} label="" />}
          selected={beltId === b.id}
          onPress={() => setBeltId(b.id)}
        />
      ))}
      {save.error ? (
        <Text variant="caption" color="danger">
          {errorMessage(save.error)}
        </Text>
      ) : null}
    </SheetForm>
  );
}
