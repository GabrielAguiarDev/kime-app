import { router } from 'expo-router';
import { useState } from 'react';

import { BottomSheet, Box, Button, EmptyState, LoadError, Screen, Text, Spinner } from '@components';
import { sortWeights, useWeightLogs, type WeightLog } from '@domain/Competition';
import { useMyProfile } from '@domain/Profile';
import { localDate } from '@domain/Water';
import { useSession } from '@services/session';

import { WeightRow, WeightSummary } from './shared';
import { WeightSheet } from './WeightSheet';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

export function MyWeightScreen() {
  const { userId } = useSession();
  const profile = useMyProfile(userId);
  const weights = useWeightLogs(userId);
  const [sheet, setSheet] = useState<{ editing?: WeightLog } | null>(null);
  const ready = !!userId && !!profile.data && !!weights.data;
  const logs = sortWeights(weights.data ?? []);
  const today = profile.data ? localDate(new Date(), profile.data.timeZone) : '';

  return (
    <Screen nativeHeader title="Meu peso" onBack={back}
      footer={ready ? <Button title="Registrar peso" icon="plus" onPress={() => setSheet({})} /> : undefined}>
      {profile.isLoading || weights.isLoading ? <Spinner accessibilityLabel="Carregando pesagens" /> : null}
      {profile.isError || weights.isError ? (
        <LoadError title="Não foi possível carregar as pesagens" onRetry={() => { void profile.refetch(); void weights.refetch(); }} />
      ) : ready ? (
        <Box gap="s24">
          <WeightSummary logs={logs} />
          <Box gap="s12">
            <Text variant="captionCaps">Histórico de peso</Text>
            {logs.length ? logs.map((log) => (
              <WeightRow key={log.id} log={log} onPress={() => setSheet({ editing: log })} />
            )) : <EmptyState title="Nenhuma pesagem registrada." description="Registre seu peso para acompanhar sua evolução." />}
          </Box>
        </Box>
      ) : null}
      <BottomSheet visible={!!sheet} onRequestClose={() => setSheet(null)}>
        {sheet && userId ? <WeightSheet athleteId={userId} today={today} logs={logs} editing={sheet.editing} onDone={() => setSheet(null)} /> : null}
      </BottomSheet>
    </Screen>
  );
}
