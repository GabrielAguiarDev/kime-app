import { router } from 'expo-router';

import { BeltChip, Box, Card, ProgressBar, Text } from '@components';
import { missing } from '@utils/plural';
import {
  beltName,
  beltProgress,
  nextClassMilestone,
  type Modality,
  type ModalityBelt,
  type ModalityStats,
} from '@domain/Classes';

const aulas = (n: number) => `${n} ${n === 1 ? 'aula' : 'aulas'}`;

/**
 * Progress in the selected modality; opens Aulas. With belts: the current
 * belt chip, "Faltam 6 aulas para a faixa azul" and the bar. Without belts:
 * the total and the next milestone ("Faltam 3 aulas para 25 aulas").
 */
export function ProgressCard({
  modality,
  belts,
  stats,
}: {
  modality: Modality;
  belts: ModalityBelt[];
  stats: ModalityStats | undefined;
}) {
  const total = stats?.confirmedTotal ?? 0;
  const open = () => router.navigate('/(tabs)/classes');

  if (!modality.usesBelts) {
    const milestone = nextClassMilestone(total);
    return (
      <Card gap="s12" onPress={open} accessibilityLabel={`${aulas(total)} de ${modality.name}. Abrir aulas`}>
        <Text variant="captionCaps">Progresso</Text>
        <Text variant="heading">{`${aulas(total)} de ${modality.name}`}</Text>
        <ProgressBar value={total} max={milestone} unit="aulas" label={`${missing(milestone - total, 'aula', 'aulas')} para ${milestone} aulas`} />
      </Card>
    );
  }

  const current = belts.find((b) => b.id === stats?.beltId) ?? null;
  const progress = beltProgress(belts, current?.id ?? null, stats?.confirmedSinceBelt ?? 0);
  const left = progress.required - progress.done;

  return (
    <Card gap="s12" onPress={open} accessibilityLabel="Progresso na faixa. Abrir aulas">
      <Box flexDirection="row" alignItems="center" justifyContent="space-between">
        <Text variant="captionCaps">Progresso</Text>
        {current ? <BeltChip belt={current} /> : <Text variant="caption">Sem faixa</Text>}
      </Box>
      {progress.next && progress.required > 0 ? (
        <ProgressBar
          value={progress.done}
          max={progress.required}
          unit="aulas"
          beltColor={progress.next.primary}
          label={
            left > 0
              ? `${missing(left, 'aula', 'aulas')} para a faixa ${beltName(progress.next).toLowerCase()}`
              : `Pronto para a faixa ${beltName(progress.next).toLowerCase()}`
          }
        />
      ) : (
        <Text variant="body" color="textMuted">
          {progress.next
            ? 'A academia ainda não definiu as aulas da próxima faixa.'
            : belts.length
              ? 'Você está na última faixa desta modalidade.'
              : 'A academia ainda não cadastrou as faixas desta modalidade.'}
        </Text>
      )}
    </Card>
  );
}
