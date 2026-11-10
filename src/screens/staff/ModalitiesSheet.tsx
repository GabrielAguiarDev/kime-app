import { useState } from 'react';

import { BottomSheet, Button, SelectionCard, Text } from '@components';
import type { Modality } from '@domain/Classes';
import { SheetForm } from '@screens/professor/shared';

/**
 * Multi-select of the academy modalities (approval and "Alterar" on the member
 * detail). At least one is required (unless `allowEmpty`): the button stays disabled until then.
 * Mount it only while visible so it starts from `initial` every time.
 */
export function ModalitiesSheet({
  visible,
  title,
  caption,
  modalities,
  initial,
  confirmLabel,
  loading,
  onConfirm,
  onClose,
  allowEmpty = false,
}: {
  visible: boolean;
  title: string;
  caption?: string;
  modalities: Modality[];
  initial: string[];
  confirmLabel: string;
  loading?: boolean;
  onConfirm: (modalityIds: string[]) => void;
  onClose: () => void;
  /** Saving with none selected is allowed (staff modalities). */
  allowEmpty?: boolean;
}) {
  return (
    <BottomSheet visible={visible} onRequestClose={onClose}>
      {visible ? (
        <ModalitiesForm
          title={title}
          caption={caption}
          modalities={modalities}
          initial={initial}
          confirmLabel={confirmLabel}
          loading={loading}
          onConfirm={onConfirm}
          allowEmpty={allowEmpty}
        />
      ) : null}
    </BottomSheet>
  );
}

function ModalitiesForm({
  title,
  caption,
  modalities,
  initial,
  confirmLabel,
  loading,
  onConfirm,
  allowEmpty,
}: {
  title: string;
  caption?: string;
  modalities: Modality[];
  initial: string[];
  confirmLabel: string;
  loading?: boolean;
  onConfirm: (modalityIds: string[]) => void;
  allowEmpty: boolean;
}) {
  const [picked, setPicked] = useState<string[]>(initial);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <SheetForm
      title={title}
      tall
      actions={
        <Button
          title={confirmLabel}
          disabled={!allowEmpty && picked.length === 0}
          loading={loading}
          onPress={() => onConfirm(modalities.filter((m) => picked.includes(m.id)).map((m) => m.id))}
        />
      }
    >
      {caption ? <Text variant="caption">{caption}</Text> : null}
      {modalities.length === 0 ? (
        <Text variant="body" color="textMuted">
          A academia ainda não tem modalidades. O dono cadastra em Perfil → Modalidades.
        </Text>
      ) : null}
      {modalities.map((m) => (
        <SelectionCard
          key={m.id}
          label={m.name}
          selected={picked.includes(m.id)}
          onPress={() => toggle(m.id)}
          accessibilityLabel={`${m.name}${picked.includes(m.id) ? ', selecionada' : ''}`}
        />
      ))}
      {!allowEmpty && picked.length === 0 && modalities.length > 0 ? (
        <Text variant="caption">Escolha pelo menos uma modalidade.</Text>
      ) : null}
    </SheetForm>
  );
}
