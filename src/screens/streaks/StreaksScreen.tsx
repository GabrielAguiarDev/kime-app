import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { Box, LoadError, Screen, Text } from '@components';
import {
  TRAINING_STREAK_RULE,
  useTrainingStreak,
  useWaterStreak,
  WATER_STREAK_RULE,
} from '@domain/Streaks';
import { useWaterDay } from '@domain/Water';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';
import { useWaterSettings } from '@services/water';

import { StreakCard } from './StreakCard';

/**
 * Ofensivas: water (daily, everyone) and training (weekly, students), with
 * freezes, record and the last periods. How freezes work is explained at the end.
 */
export function StreaksScreen() {
  const { userId } = useSession();
  const { active, isStaff } = useActiveGym();
  const { settings } = useWaterSettings();
  // Subscribes to today's logs: the water streak re-reads the device on each log.
  useWaterDay(userId, settings?.timeZone);
  const water = useWaterStreak(userId, settings?.timeZone, settings?.goalMl ?? null, settings?.isLimit);
  const training = useTrainingStreak(isStaff ? undefined : active?.gymId, userId);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen nativeHeader title="Ofensivas" onBack={back}>
      <Box gap="s24">
        {water.streak ? (
          <StreakCard
            title="Água"
            unit="day"
            streak={water.streak}
            rule={WATER_STREAK_RULE}
            doneText={settings?.isLimit ? "Limite de hoje cumprido." : "Meta de hoje batida."}
            pendingText={settings?.isLimit ? "Fique entre 90% e 100% do limite hoje para manter." : "Bata a meta de água hoje para manter."}
            emptyText={settings?.goalMl ? (settings.isLimit ? 'Fique entre 90% e 100% do limite hoje para começar.' : 'Bata a meta de água hoje para começar.') : 'Informe seu peso para ter uma meta de água.'}
          />
        ) : water.isError ? (
          <LoadError title="Não foi possível carregar a ofensiva de água" onRetry={water.refetch} />
        ) : (
          <ActivityIndicator accessibilityLabel="Carregando" />
        )}

        {!isStaff && active ? (
          training.streak ? (
            <StreakCard
              title={`Treino · ${active.gymName}`}
              unit="week"
              streak={training.streak}
              rule={TRAINING_STREAK_RULE}
              doneText="Semana garantida: já tem aula confirmada."
              pendingText="Treine esta semana para manter."
              emptyText="Faça uma aula esta semana para começar."
            />
          ) : training.isError ? (
            <LoadError title="Não foi possível carregar a ofensiva de treino" onRetry={training.refetch} />
          ) : (
            <ActivityIndicator accessibilityLabel="Carregando" />
          )
        ) : null}

        <Box gap="s8">
          <Text variant="captionCaps">Congelamentos</Text>
          <Text variant="body" color="textMuted">
            A cada 7 dias seguidos cumprindo o objetivo de água, e a cada 4 semanas seguidas treinando, você ganha um
            congelamento (no máximo 2 de cada). Se perder um dia ou uma semana, ele é usado sozinho e a ofensiva continua.
          </Text>
          <Text variant="body" color="textMuted">
            No treino, só aulas confirmadas pelo professor contam. A semana atual só conta como perdida quando acaba.
          </Text>
        </Box>
      </Box>
    </Screen>
  );
}
