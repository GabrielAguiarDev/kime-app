import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { Box, Button, Card, Text, TextButton, WaterRing } from '@components';
import { waterDayState } from '@domain/Water';
import { keyValueStorage } from '@infra';
import { formatMl } from '@screens/water/format';
import { useLogBottle } from '@screens/water/useLogBottle';

/**
 * "Adicionar widget" shows only on the first day the goal is met (until the
 * link is opened): that day is stored per user.
 */
function useWidgetHint(userId: string | undefined, date: string | undefined, done: boolean) {
  if (!userId || !date || !done) return { show: false, seen: () => {} };
  let stored: string | null = null;
  try {
    stored = keyValueStorage.getScoped('widgetHint', userId);
    if (!stored) {
      keyValueStorage.setScoped('widgetHint', userId, date);
      stored = date;
    }
  } catch {
    stored = 'seen';
  }
  return { show: stored === date, seen: () => keyValueStorage.setScoped('widgetHint', userId, 'seen') };
}

/**
 * Water of today: the widget's ring (medium), total and goal (or limit), what
 * is left and the tactile "+{garrafa} ML" button. Opens the Água screen.
 * Without a bottle: an invite to set it up.
 */
export function WaterCard() {
  const water = useLogBottle();
  const state = waterDayState(water.totalMl, water.goalMl, water.isLimit);
  const hint = useWidgetHint(water.userId, water.date, state === 'done');

  // Settings still loading: not "no bottle" yet.
  if (water.isLoading) {
    return (
      <Card gap="s12">
        <Text variant="captionCaps">Água de hoje</Text>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Card>
    );
  }

  if (!water.bottleMl) {
    return (
      <Card gap="s12">
        <Text variant="captionCaps">Água de hoje</Text>
        <Text variant="body">Configure sua garrafa para registrar água com um toque, no app e no widget.</Text>
        <Button title="Configurar garrafa" variant="secondary" icon="drop" onPress={() => router.push('/agua/configurar')} />
      </Card>
    );
  }

  const left = water.goalMl !== null ? Math.max(0, water.goalMl - water.totalMl) : null;
  const goalLine =
    water.goalMl === null
      ? 'Informe seu peso para calcular a meta.'
      : `${water.isLimit ? 'Limite' : 'Meta'}: ${formatMl(water.goalMl)} ml`;
  const leftLine =
    state === 'over'
      ? 'Você passou do limite de hoje.'
      : state === 'done'
        ? water.isLimit
          ? 'Limite do dia cumprido.'
          : 'Meta do dia batida.'
        : left !== null
          ? `Faltam ${formatMl(left)} ml`
          : null;

  return (
    <Card gap="s16" onPress={() => router.push('/agua')} accessibilityLabel={`Água de hoje: ${formatMl(water.totalMl)} ml. Abrir`}>
      <Text variant="captionCaps">Água de hoje</Text>
      <Box flexDirection="row" alignItems="center" gap="s16">
        <Box flexShrink={0}>
          <WaterRing consumedMl={water.totalMl} goalMl={water.goalMl} isLimit={water.isLimit} size={72} hideLabel />
        </Box>
        <Box flex={1} minWidth={0} gap="s4">
          <Text variant="heading" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{formatMl(water.totalMl)} ml</Text>
          <Text variant="caption">{goalLine}</Text>
          {leftLine ? (
            <Text variant="bodyStrong" color={state === 'over' ? 'warning' : state === 'done' ? 'water' : 'text'}>
              {leftLine}
            </Text>
          ) : null}
        </Box>
      </Box>
      <Button
        title={`+${formatMl(water.bottleMl)} ml`}
        variant="water"
        icon="drop"
        loading={water.isPending}
        onPress={water.log}
        accessibilityLabel={`Registrar ${formatMl(water.bottleMl)} ml de água`}
      />
      {hint.show ? (
        <TextButton
          title="Adicionar widget"
          fullWidth={false}
          onPress={() => {
            hint.seen();
            router.push('/agua/widget');
          }}
        />
      ) : null}
    </Card>
  );
}
