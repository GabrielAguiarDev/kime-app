import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

import { Box, Card, EmptyState, HeaderButton, Icon, LoadError, PersonList, Screen, Text } from '@components';
import { useAcademyToday, type LocalDate } from '@domain/Classes';
import { formatShortDate } from '@domain/Competition';
import { addMonths, categoryLabel, formatMoney, monthOf, useExpenses, type Expense } from '@domain/Finance';
import { useActiveGym } from '@services/activeGym';
import { useAppTheme } from '@theme';

import { back, MoneyStat, MonthSwitcher } from './parts';

/** Expenses can be entered up to a year ahead (next month's rent, for example). */
const MONTHS_AHEAD = 12;

/** Owner: expenses of one month, with the total; tap to edit, "+" to add. */
export function ExpensesScreen() {
  const params = useLocalSearchParams<{ month?: string }>();
  const { active } = useActiveGym();
  const academyId = active?.gymId;
  const today = useAcademyToday(academyId);
  const current = today.data ? monthOf(today.data) : undefined;
  const [picked, setPicked] = useState<LocalDate | undefined>(params.month);
  const month = picked ?? current;

  const add = () =>
    router.push({ pathname: '/financeiro/despesa', params: month ? { month } : {} });
  const headerRight = <HeaderButton icon="plus" accessibilityLabel="Nova despesa" onPress={add} />;

  if (!academyId || today.isLoading || !month || !current) {
    return (
      <Screen nativeHeader title="Despesas" onBack={back} headerRight={headerRight}>
        {today.isError ? (
          <LoadError title="Não foi possível carregar as despesas" onRetry={() => void today.refetch()} />
        ) : (
          <ActivityIndicator accessibilityLabel="Carregando" />
        )}
      </Screen>
    );
  }

  return (
    <Screen nativeHeader title="Despesas" onBack={back} headerRight={headerRight}>
      <Box gap="s24">
        <MonthSwitcher month={month} max={addMonths(current, MONTHS_AHEAD)} onChange={setPicked} />
        <MonthExpenses academyId={academyId} month={month} />
      </Box>
    </Screen>
  );
}

function MonthExpenses({ academyId, month }: { academyId: string; month: LocalDate }) {
  const expenses = useExpenses(academyId, month);
  if (expenses.isLoading) return <ActivityIndicator accessibilityLabel="Carregando" />;
  if (expenses.isError) {
    return <LoadError title="Não foi possível carregar as despesas" onRetry={() => void expenses.refetch()} />;
  }
  const list = expenses.data ?? [];
  if (list.length === 0) {
    return <EmptyState visual="icon" icon="minus" title="Nenhuma despesa neste mês." />;
  }
  const total = list.reduce((sum, e) => sum + e.amountCents, 0);
  return (
    <Box gap="s16">
      <Card>
        <MoneyStat label="Total do mês" cents={total} align="center" />
      </Card>
      <PersonList>
        {list.map((e, i) => (
          <ExpenseRow key={e.id} expense={e} last={i === list.length - 1} />
        ))}
      </PersonList>
    </Box>
  );
}

function ExpenseRow({ expense, last }: { expense: Expense; last: boolean }) {
  const { border } = useAppTheme();
  const details = [categoryLabel(expense.category), formatShortDate(expense.expenseDate)];
  if (expense.repeatsMonthly) details.push('Repete todo mês');
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/financeiro/despesa', params: { id: expense.id, month: monthOf(expense.expenseDate) } })}
      accessibilityRole="button"
      accessibilityLabel={`${expense.description}, ${formatMoney(expense.amountCents)}, ${details.join(', ')}. Editar`}
    >
      <Box
        minHeight={64}
        flexDirection="row"
        alignItems="center"
        gap="s12"
        style={{ paddingVertical: 12 }}
        borderBottomWidth={last ? 0 : border.width}
        borderColor="border"
      >
        <Box flex={1} gap="s4">
          <Text variant="bodyStrong" numberOfLines={1}>
            {expense.description}
          </Text>
          <Text variant="caption" numberOfLines={1}>
            {details.join(' · ')}
          </Text>
        </Box>
        <Text variant="bodyStrong">{formatMoney(expense.amountCents)}</Text>
        <Icon name="chevronRight" color="textMuted" />
      </Box>
    </Pressable>
  );
}
