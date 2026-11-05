import { ActivityIndicator } from 'react-native';

import { Box, Button, Card, LoadError, Text, TextButton } from '@components';
import { useModalities } from '@domain/Classes';
import { useModalityEnrollments, useSetModalityEnrollment, type ModalityEnrollmentStatus } from '@domain/Ranking/useCases/useModalityEnrollments';
import { errorMessage } from '@infra';
import { useConfirm } from '@services/confirm';

export function StudentModalityEnrollments({ academyId, membershipId }: { academyId: string; membershipId: string }) {
  const modalities = useModalities(academyId);
  const enrollments = useModalityEnrollments(membershipId);
  const set = useSetModalityEnrollment(membershipId);
  const confirm = useConfirm();

  const change = async (modalityId: string, name: string, status: ModalityEnrollmentStatus) => {
    const action = status === 'active' ? 'Ativar matrícula' : status === 'suspended' ? 'Suspender matrícula' : 'Encerrar matrícula';
    const ok = await confirm({
      title: `${action}?`,
      message: status === 'active'
        ? `${name}: o aluno participa deste ranking. Somente dias completos após a ativação serão avaliados.`
        : `${name}: o aluno deixa de competir enquanto a matrícula não estiver ativa. O histórico será preservado.`,
      confirmLabel: action,
      tone: status === 'ended' ? 'danger' : undefined,
    });
    if (ok) set.mutate({ modalityId, status });
  };

  return (
    <Box gap="s12">
      <Text variant="captionCaps">Matrículas por modalidade</Text>
      <Text variant="caption">Cada modalidade tem seu próprio ranking. Suspensões e saídas preservam o histórico e excluem os dias sem matrícula ativa.</Text>
      {modalities.isLoading || enrollments.isLoading ? <ActivityIndicator /> : null}
      {modalities.isError || enrollments.isError ? (
        <LoadError title="Não foi possível carregar as matrículas" onRetry={() => { void modalities.refetch(); void enrollments.refetch(); }} />
      ) : null}
      {modalities.data?.map((m) => {
        const status = enrollments.data?.find((e) => e.modality_id === m.id)?.status;
        const disabled = !enrollments.isSuccess || set.isPending;
        return (
          <Card key={m.id} gap="s8">
            <Text variant="bodyStrong">{m.name}</Text>
            <Text variant="caption">{status === 'active' ? 'Matrícula ativa' : status === 'suspended' ? 'Matrícula suspensa' : status === 'ended' ? 'Matrícula encerrada' : 'Sem matrícula'}</Text>
            {status !== 'active' ? (
              <Button title={status ? 'Reativar matrícula' : 'Matricular'} variant="secondary" disabled={disabled} onPress={() => void change(m.id, m.name, 'active')} />
            ) : (
              <TextButton title="Suspender matrícula" disabled={disabled} onPress={() => void change(m.id, m.name, 'suspended')} />
            )}
            {status && status !== 'ended' ? (
              <TextButton title="Encerrar matrícula" color="danger" disabled={disabled} onPress={() => void change(m.id, m.name, 'ended')} />
            ) : null}
          </Card>
        );
      })}
      {set.error ? <Text variant="caption" color="danger">{errorMessage(set.error)}</Text> : null}
    </Box>
  );
}
