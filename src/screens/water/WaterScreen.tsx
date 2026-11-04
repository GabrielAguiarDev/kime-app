import { router } from 'expo-router';
import { ActivityIndicator, Alert } from 'react-native';

import { Box, Button, Card, EmptyState, FeedbackSheet, Icon, Screen, Text, TextButton, WaterRing } from '@components';
import { crossedGoal, useLogWater, useUndoWater, useWaterDay } from '@domain/Water';
import { errorMessage } from '@infra';
import { useWaterGoalFeedback, useWaterSettings } from '@services/water';
import { haptics } from '@utils/haptics';

import { formatMl, formatTime } from './format';

/**
 * Water of today (profile time zone): ring (3.4), "+{garrafa} ML" water button,
 * today's logs (from the app and the widget) and undo of the last one.
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
  const totalMl = day.data?.totalMl ?? 0;
  const goalFeedback = useWaterGoalFeedback(userId, day.data?.date, day.data?.totalMl, goalMl);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const settingsAction = {
    icon: 'settings' as const,
    accessibilityLabel: 'Garrafa, peso e altura',
    onPress: () => router.push('/agua/configurar'),
  };

  if (isLoading || (!!bottleMl && day.isLoading)) {
    return (
      <Screen title="Água" onBack={back}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen title="Água" onBack={back}>
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
      <Screen
        title="Água"
        onBack={back}
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
        if (crossedGoal(totalMl, totalMl + bottleMl, goalMl)) haptics.success();
      },
      onError: (e) => Alert.alert('Água', errorMessage(e)),
    });
  };

  const logs = day.data?.logs ?? [];

  return (
    <Screen
      title="Água"
      onBack={back}
      topAction={settingsAction}
      feedback={
        goalFeedback.visible ? (
          // TODO(motion): feedback sheet entering and leaving.
          <FeedbackSheet
            tone="water"
            title="Meta do dia batida."
            message={`${formatMl(totalMl)} ml hoje.`}
            actionLabel="Continuar"
            onAction={goalFeedback.dismiss}
          />
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
          <WaterRing consumedMl={totalMl} goalMl={goalMl} />
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
      </Box>
    </Screen>
  );
}
