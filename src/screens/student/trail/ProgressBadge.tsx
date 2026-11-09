import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { BeltSwatch, Box, Icon, Text } from '@components';
import { beltName, beltProgress, type Modality, type ModalityBelt, type ModalityStats } from '@domain/Classes';
import { useAppTheme } from '@theme';

/** Ring around the belt (points) and its stroke. */
const RING = 30;
const STROKE = 3;

interface ProgressBadgeProps {
  modality: Modality;
  /** Belts of the modality, in order. */
  belts: ModalityBelt[];
  stats: ModalityStats | undefined;
  onPress: () => void;
}

/**
 * Compact progress seal for the Aulas header (headerRight): the current belt
 * inside a small progress ring and "4/10" next to it. Modality without belts:
 * a medal and the class total. Opens the Jornada.
 */
export function ProgressBadge({ modality, belts, stats, onPress }: ProgressBadgeProps) {
  const { colors, spacing } = useAppTheme();
  const total = stats?.confirmedTotal ?? 0;

  if (!modality.usesBelts || belts.length === 0) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${total} ${total === 1 ? 'aula' : 'aulas'} de ${modality.name}. Abrir a jornada`} hitSlop={spacing.s8}>
        <Box flexDirection="row" alignItems="center" gap="s4">
          <Icon name="medal" color="accent" size={20} />
          <Text variant="bodyStrong">{total}</Text>
        </Box>
      </Pressable>
    );
  }

  const current = belts.find((b) => b.id === stats?.beltId) ?? null;
  const progress = beltProgress(belts, current?.id ?? null, stats?.confirmedSinceBelt ?? 0);
  const last = !progress.next;
  const ratio = last ? 1 : progress.required > 0 ? Math.min(1, progress.done / progress.required) : 0;
  const count = last ? `${total}` : progress.required > 0 ? `${progress.done}/${progress.required}` : '–';
  const r = (RING - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const label = last
    ? `Faixa ${current ? beltName(current).toLowerCase() : ''}, última da modalidade. ${total} ${total === 1 ? 'aula' : 'aulas'}. Abrir a jornada`
    : `${current ? `Faixa ${beltName(current).toLowerCase()}` : 'Sem faixa'}. ${progress.done} de ${progress.required} ${progress.required === 1 ? 'aula' : 'aulas'} até a próxima. Abrir a jornada`;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={spacing.s8}>
      <Box flexDirection="row" alignItems="center" gap="s8">
        <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={RING} height={RING} style={{ position: 'absolute' }}>
            <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={colors.border} strokeWidth={STROKE} fill="none" />
            {ratio > 0 ? (
              <Circle
                cx={RING / 2}
                cy={RING / 2}
                r={r}
                stroke={colors.accent}
                strokeWidth={STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${circumference * ratio} ${circumference}`}
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              />
            ) : null}
          </Svg>
          <BeltSwatch belt={current ?? progress.next} width={16} height={6} />
        </View>
        <Text variant="bodyStrong">{count}</Text>
      </Box>
    </Pressable>
  );
}
