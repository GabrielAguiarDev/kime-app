import { ActivityIndicator } from 'react-native';

import { Box, LoadError, SelectionCard, Text } from '@components';
import { useSchedules, WEEKDAY_LABELS } from '@domain/Classes';
import { useModalityEnrollments } from '@domain/Ranking/useCases/useModalityEnrollments';
import { useClassEnrollments, useSetClassEnrollment } from '@domain/Ranking/useCases/useClassEnrollments';
import { errorMessage } from '@infra';
import { useConfirm } from '@services/confirm';

/** Explicit staff assignment, rather than inferring obligations from optional classes. */
export function StudentClassEnrollments({ academyId, membershipId }: { academyId: string; membershipId: string }) {
  const schedules = useSchedules(academyId);
  const enrollments = useClassEnrollments(membershipId);
  const set = useSetClassEnrollment(membershipId);
  const confirm = useConfirm();
  const modalities = useModalityEnrollments(membershipId);
  return (
    <Box gap="s12">
      <Text variant="captionCaps">Turmas obrigatórias</Text>
      <Text variant="caption">Somente estas turmas entram na frequência e nas faltas do ranking. Alterações valem a partir de amanhã. As demais aulas são opcionais.</Text>
      {schedules.isLoading || enrollments.isLoading ? <ActivityIndicator /> : null}
      {schedules.isError || enrollments.isError ? <LoadError title="Não foi possível carregar as turmas" onRetry={() => { void schedules.refetch(); void enrollments.refetch(); }} /> : null}
      {schedules.data?.filter((s) => s.active).map((s) => {
        const enrolled = enrollments.data?.some((e) => e.schedule_id === s.id) ?? false;
        const active = modalities.data?.some((m) => m.modality_id === s.modalityId && m.status === 'active') ?? false;
        return <SelectionCard
          key={s.id}
          label={`${s.modality} · ${WEEKDAY_LABELS[s.weekday].long} · ${s.startTime}`}
          description={!active ? 'Ative a matrícula nesta modalidade para definir a turma' : enrolled ? 'Obrigatória a partir do vínculo' : 'Opcional'}
          selected={enrolled}
          disabled={!enrollments.isSuccess || !modalities.isSuccess || (!active && !enrolled) || set.isPending}
          onPress={async () => {
            const ok = await confirm({
              title: enrolled ? 'Tornar turma opcional?' : 'Definir turma obrigatória?',
              message: enrolled ? 'A partir de amanhã, esta turma deixa de gerar faltas no ranking.' : 'A partir de amanhã, faltas nesta turma reduzem a frequência e geram penalidades no ranking.',
              confirmLabel: enrolled ? 'Tornar opcional' : 'Definir obrigatória',
            });
            if (ok) set.mutate({ scheduleId: s.id, enrolled: !enrolled });
          }}
        />;
      })}
      {set.error ? <Text variant="caption" color="danger">{errorMessage(set.error)}</Text> : null}
    </Box>
  );
}
