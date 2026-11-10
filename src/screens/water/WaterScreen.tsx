import { router } from 'expo-router';
import { ActivityIndicator, Alert } from 'react-native';

import { Box, Button, Card, EmptyState, Icon, Screen, Text, TextButton, WaterRing } from '@components';
import { waterDayState, useLogWater, useUndoWater, useWaterDay, useWaterHistory } from '@domain/Water';
import { errorMessage } from '@infra';
import { useWaterGoalFeedback, useWaterSettings } from '@services/water';
import { haptics } from '@utils/haptics';

import { useActiveModality } from '@services/activeModality';

import { formatMl, formatTime } from './format';
import { WaterGoalSheet } from './WaterGoalSheet';
import { AddWidgetLink, CompetitorWater, LastDaysBars } from './WaterSections';

/**
 * Water of today (profile time zone): ring (3.4), "+{garrafa} ML" water button,
 * today's logs (from the app and the widget) and undo of the last one; the
 * last 7 days in bars; for competitors the
 * professor's plan of the week and today's diet; "Adicionar widget" at the end.
 * Bottle, weight and height: settings icon at the top-right.
 */
export function WaterScreen() {
  // Profile, or the config published for the widget when offline.
  const { userId, settings, isLoading, isError, refetch } = useWaterSettings();
  const timeZone = settings?.timeZone;
  const day = useWaterDay(userId, timeZone);
  const logWater = useLogWater(userId);
  const undo = useUndoWater(userId, timeZone);

  const bottleMl = settings?.bottleMl ?? null;
  const goalMl = settings?.goalMl ?? null;
  const isLimit = settings?.isLimit ?? false;
  const totalMl = day.data?.totalMl ?? 0;
  const goalFeedback = useWaterGoalFeedback(userId, day.data?.date, day.data?.totalMl, goalMl, isLimit);
  const waterDays = useWaterHistory(userId, timeZone, goalMl, isLimit);
  const { modalities } = useActiveModality();
  const competes = modalities.some((m) => m.link.isCompetitor);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const settingsAction = {
    icon: 'settings' as const,
    accessibilityLabel: 'Garrafa e meta de água',
    onPress: () => router.push('/agua/configurar'),
  };

  if (isLoading || (!!bottleMl && day.isLoading)) {
    return (
      <Screen nativeHeader title="Água" onBack={back} topAction={settingsAction}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen nativeHeader title="Água" onBack={back} topAction={settingsAction}>
        <EmptyState
          visual="icon"
          icon="offline"
          title="Não foi possível carregar seu perfil"
          action={<Button title="Tentar de novo" variant="secondary" onPress={refetch} />}
        />
      </Screen>
    );
  }

  if (!bottleMl) {
    return (
      <Screen nativeHeader
        title="Água"
        onBack={back}
        topAction={settingsAction}
        footer={<Button title="Configurar garrafa" onPress={() => router.push('/agua/configurar')} />}
      >
        <EmptyState
          title="Configure sua garrafa para registrar água."
          description="Com o tamanho da garrafa, cada toque registra uma garrafa, no app e no widget."
        />
      </Screen>
    );
  }

  const log = () => {
    haptics.water();
    logWater.mutate(bottleMl, {
      onSuccess: () => {
        if (waterDayState(totalMl, goalMl, isLimit) !== 'done' && waterDayState(totalMl + bottleMl, goalMl, isLimit) === 'done') haptics.success();
      },
      onError: (e) => Alert.alert('Água', errorMessage(e)),
    });
  };

  const logs = day.data?.logs ?? [];

  return (
    <Screen nativeHeader
      title="Água"
      onBack={back}
      topAction={settingsAction}
      feedback={
        goalFeedback.visible ? (
          <WaterGoalSheet isLimit={!!isLimit} totalMl={totalMl} onAction={goalFeedback.dismiss} />
        ) : undefined
      }
      footer={
        <Button
          title={`+${formatMl(bottleMl)} ml`}
          variant="water"
          icon="drop"
          loading={logWater.isPending}
          onPress={log}
          accessibilityLabel={`Registrar ${formatMl(bottleMl)} ml de água`}
        />
      }
    >
      <Box gap="s24">
        <Box alignItems="center" gap="s8">
          <WaterRing consumedMl={totalMl} goalMl={goalMl} isLimit={isLimit} />
          {waterDayState(totalMl, goalMl, isLimit) === 'over' ? <Text variant="caption" color="warning">Você passou do limite de hoje</Text> : null}
          {goalMl === null ? (
            <TextButton
              title="Informe seu peso para calcular a meta"
              fullWidth={false}
              onPress={() => router.push('/agua/configurar')}
            />
          ) : null}
        </Box>

        <Box gap="s12">
          <Text variant="captionCaps">Hoje</Text>
          {logs.length === 0 ? (
            <Text variant="body" color="textMuted">
              Nenhum registro ainda. Toque em +{formatMl(bottleMl)} ml a cada garrafa.
            </Text>
          ) : null}
          {logs
            .slice()
            .reverse()
            .map((entry) => (
              <Card key={entry.id} flexDirection="row" alignItems="center" gap="s12">
                <Icon name="drop" color="water" />
                <Box flex={1}>
                  <Text variant="bodyStrong">+{formatMl(entry.amountMl)} ml</Text>
                  {entry.source === 'widget' ? <Text variant="caption">Pelo widget</Text> : null}
                </Box>
                <Text variant="caption">{timeZone ? formatTime(entry.loggedAt, timeZone) : ''}</Text>
              </Card>
            ))}
          {logs.length > 0 ? (
            <TextButton
              title="Desfazer último registro"
              disabled={undo.isPending}
              onPress={() => undo.mutate(undefined, { onError: (e) => Alert.alert('Água', errorMessage(e)) })}
            />
          ) : null}
        </Box>

        {day.data ? <LastDaysBars days={waterDays} today={day.data.date} /> : null}
        {competes && userId && day.data ? <CompetitorWater userId={userId} today={day.data.date} /> : null}
        <AddWidgetLink />
      </Box>
    </Screen>
  );
}
