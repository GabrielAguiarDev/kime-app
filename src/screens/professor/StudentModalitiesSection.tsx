import { useState } from 'react';
import { Alert } from 'react-native';

import { Box, Card, Text, TextButton } from '@components';
import type { Modality } from '@domain/Classes';
import { useSetStudentModalities, type GymMember } from '@domain/Membership';
import { errorMessage } from '@infra';
import { ModalitiesSheet } from '@screens/staff/ModalitiesSheet';
import { useConfirm } from '@services/confirm';
import { haptics } from '@utils/haptics';

/** Staff, member detail: the student's modalities (at least one). */
export function StudentModalitiesSection({ member, modalities }: { member: GymMember; modalities: Modality[] }) {
  const setModalities = useSetStudentModalities();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);

  const linked = modalities.flatMap((m) => {
    const link = member.modalities.find((l) => l.modalityId === m.id);
    return link ? [{ modality: m, link }] : [];
  });

  const save = async (modalityIds: string[]) => {
    const removedCompetitor = member.modalities.find((m) => m.isCompetitor && !modalityIds.includes(m.modalityId));
    if (removedCompetitor) {
      const ok = await confirm({ title: 'Tirar modalidade?', message: `${member.fullName} também sai da equipe de competição desta modalidade.`, confirmLabel: 'Tirar modalidade', tone: 'danger' });
      if (!ok) return;
    }
    setModalities.mutate(
      { membershipId: member.id, modalityIds },
      {
        onSuccess: () => {
          setEditing(false);
          haptics.success();
        },
        onError: (e) => Alert.alert('Modalidades', errorMessage(e)),
      },
    );
  };

  return (
    <Box gap="s12">
      <Box flexDirection="row" alignItems="center" justifyContent="space-between">
        <Text variant="captionCaps">Modalidades</Text>
        <TextButton title="Alterar" onPress={() => setEditing(true)} />
      </Box>
      {linked.length === 0 ? (
        <Text variant="body" color="textMuted">
          Nenhuma modalidade.
        </Text>
      ) : null}
      {linked.map(({ modality }) => (
        <Card key={modality.id}>
          <Text variant="bodyStrong">{modality.name}</Text>
        </Card>
      ))}

      <ModalitiesSheet
        visible={editing}
        title="Modalidades do aluno"
        caption="Tirar uma modalidade mantém o histórico de aulas e faixas dela."
        modalities={modalities}
        initial={linked.map((l) => l.modality.id)}
        confirmLabel="Salvar"
        loading={setModalities.isPending}
        onConfirm={save}
        onClose={() => setEditing(false)}
      />
    </Box>
  );
}
