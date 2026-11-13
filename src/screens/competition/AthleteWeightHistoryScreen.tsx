import { router } from 'expo-router';
import { useState } from 'react';

import { BottomSheet, Box, Button, EmptyState, FilterChips, Screen, SelectionCard, Text, Spinner } from '@components';
import {
  filterWeights,
  formatKg,
  formatLocalDate,
  MONTH_NAMES,
  useWeightLogs,
  weightMonths,
  weightYears,
} from '@domain/Competition';
import { SheetForm } from '@screens/professor/shared';

import { useAthlete } from './useAthlete';

/**
 * Staff: every weigh-in of a competitor, newest first, filtered by year (chips) and, inside a
 * year, by month (a chip that opens the list of months with weigh-ins).
 */
export function AthleteWeightHistoryScreen() {
  const { member, isLoading, notCompetitor, back } = useAthlete();
  const weights = useWeightLogs(member?.userId, { all: true });
  const [year, setYear] = useState<string | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);

  const title = 'Histórico de peso';
  const subtitle = member?.fullName;

  if (isLoading || weights.isLoading) {
    return (
      <Screen nativeHeader title={title} subtitle={subtitle} onBack={back}>
        <Spinner accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if (notCompetitor || !member) {
    return (
      <Screen nativeHeader title={title} onBack={back}>
        <EmptyState title="Este aluno não está na equipe." description="O peso só aparece para atletas da equipe de competição." />
      </Screen>
    );
  }
  if (weights.isError) {
    return (
      <Screen nativeHeader title={title} subtitle={subtitle} onBack={back}>
        <EmptyState
          visual="icon"
          icon="offline"
          title="Não foi possível carregar o peso"
          action={<Button title="Tentar de novo" variant="secondary" onPress={() => void weights.refetch()} />}
        />
      </Screen>
    );
  }

  const logs = weights.data ?? [];
  const years = weightYears(logs);
  const months = year ? weightMonths(logs, year) : [];
  const shown = filterWeights(logs, year, month);
  const pickYear = (y: string | null) => {
    setYear(y);
    setMonth(null);
  };

  return (
    <Screen nativeHeader title={title} subtitle={subtitle} onBack={back}>
      {logs.length === 0 ? (
        <EmptyState title="Nenhum peso registrado ainda." />
      ) : (
        <Box gap="s16" paddingTop="s8">
          <FilterChips
            accessibilityLabel="Filtrar por ano"
            chips={[
              { key: 'all', label: 'Todos', selected: year === null, onPress: () => pickYear(null) },
              ...years.map((y) => ({ key: y, label: y, selected: year === y, onPress: () => pickYear(y) })),
            ]}
          />
          {year ? (
            <FilterChips
              accessibilityLabel="Filtrar por mês"
              chips={[
                {
                  key: 'month',
                  label: month ? MONTH_NAMES[month - 1]! : 'Todos os meses',
                  selected: month !== null,
                  icon: 'chevronDown',
                  accessibilityLabel: `Mês: ${month ? MONTH_NAMES[month - 1] : 'todos'}. Trocar`,
                  onPress: () => setPicking(true),
                },
              ]}
            />
          ) : null}

          <Text variant="caption">{`${shown.length} ${shown.length === 1 ? 'pesagem' : 'pesagens'}`}</Text>
          <Box gap="s8">
            {shown.map((log) => (
              <Box
                key={log.id}
                flexDirection="row"
                alignItems="center"
                justifyContent="space-between"
                paddingVertical="s12"
                borderBottomWidth={1}
                borderColor="border"
                accessible
                accessibilityLabel={`${formatLocalDate(log.loggedOn)}: ${formatKg(log.weightKg)} quilos`}
              >
                <Text variant="body">{formatLocalDate(log.loggedOn)}</Text>
                <Text variant="bodyStrong">{formatKg(log.weightKg)} kg</Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      <BottomSheet visible={picking} onRequestClose={() => setPicking(false)}>
        <SheetForm title={`Mês · ${year ?? ''}`}>
          <SelectionCard
            label="Todos os meses"
            selected={month === null}
            onPress={() => {
              setMonth(null);
              setPicking(false);
            }}
          />
          {months.map((m) => (
            <SelectionCard
              key={m}
              label={MONTH_NAMES[m - 1]!}
              selected={month === m}
              onPress={() => {
                setMonth(m);
                setPicking(false);
              }}
            />
          ))}
        </SheetForm>
      </BottomSheet>
    </Screen>
  );
}

/** Weight history of the athlete of `membershipId` (staff). */
export function openWeightHistory(membershipId: string) {
  router.push({ pathname: '/athlete/weight-history', params: { membershipId } });
}
