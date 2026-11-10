import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Switch } from 'react-native';

import {
  Box,
  Button,
  Card,
  EmptyState,
  FilterChips,
  HeaderButton,
  Icon,
  LoadError,
  Screen,
  Text,
  TextField,
} from '@components';
import { useAcademyToday, type LocalDate } from '@domain/Classes';
import { parseBrDate, toBrDate } from '@domain/Competition';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_DESCRIPTION_MAX,
  EXPENSE_MAX_CENTS,
  monthOf,
  moneyToText,
  parseMoney,
  useExpenseMutations,
  useExpenses,
  type Expense,
  type ExpenseCategory,
} from '@domain/Finance';
import { maskBirthDate } from '@domain/Profile';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useConfirm } from '@services/confirm';
import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

import { back } from './parts';

/** Owner: new expense (`month` suggests the date) or edit one (`id`, with `month` to find it). */
export function ExpenseFormScreen() {
  const { id, month } = useLocalSearchParams<{ id?: string; month?: string }>();
  const { active } = useActiveGym();
  const academyId = active?.gymId;
  const today = useAcademyToday(academyId);
  const listMonth = month ?? (today.data ? monthOf(today.data) : '');
  const expenses = useExpenses(id && listMonth ? academyId : undefined, listMonth);
  const title = id ? 'Editar despesa' : 'Nova despesa';
  const expense = id ? expenses.data?.find((e) => e.id === id) : undefined;

  if (!academyId || today.isLoading || (id && expenses.isLoading)) {
    return (
      <Screen nativeHeader title={title} onBack={back}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if (today.isError || !today.data || (id && expenses.isError)) {
    return (
      <Screen nativeHeader title={title} onBack={back}>
        <LoadError
          title="Não foi possível carregar a despesa"
          onRetry={() => {
            void today.refetch();
            void expenses.refetch();
          }}
        />
      </Screen>
    );
  }
  if (id && !expense) {
    return (
      <Screen nativeHeader title={title} onBack={back}>
        <EmptyState title="Despesa não encontrada." description="Ela pode ter sido apagada." />
      </Screen>
    );
  }
  // A new expense in another month starts on that month's first day.
  const suggested = month && month !== monthOf(today.data) ? month : today.data;
  return <ExpenseForm academyId={academyId} expense={expense} suggestedDate={suggested} title={title} />;
}

function ExpenseForm({
  academyId,
  expense,
  suggestedDate,
  title,
}: {
  academyId: string;
  expense: Expense | undefined;
  suggestedDate: LocalDate;
  title: string;
}) {
  const { colors } = useAppTheme();
  const confirm = useConfirm();
  const { save, remove } = useExpenseMutations(academyId);
  const [description, setDescription] = useState(expense?.description ?? '');
  const [category, setCategory] = useState<ExpenseCategory | null>(expense?.category ?? null);
  const [amount, setAmount] = useState(moneyToText(expense?.amountCents));
  const [date, setDate] = useState(toBrDate(expense?.expenseDate ?? suggestedDate));
  const [repeats, setRepeats] = useState(expense?.repeatsMonthly ?? false);

  const cents = parseMoney(amount, { max: EXPENSE_MAX_CENTS });
  const amountError = amount.trim() && cents === null ? 'Use um valor como 350,00.' : undefined;
  const expenseDate = parseBrDate(date);
  const dateError = date.length === 10 && !expenseDate ? 'Use uma data válida no formato DD/MM/AAAA.' : undefined;
  const valid = description.trim().length > 0 && !!category && cents !== null && !!expenseDate;
  const error = save.error ?? remove.error;

  const submit = () => {
    if (!valid || !category || cents === null || !expenseDate) return;
    save.mutate(
      {
        id: expense?.id ?? null,
        input: { description, category, amountCents: cents, expenseDate, repeatsMonthly: repeats },
      },
      {
        onSuccess: () => {
          void haptics.success();
          back();
        },
      },
    );
  };

  const del = async () => {
    if (!expense) return;
    const ok = await confirm({
      title: 'Apagar despesa?',
      message: expense.repeatsMonthly
        ? `${expense.description} sai deste mês. Os outros meses continuam como estão.`
        : `${expense.description} sai das despesas.`,
      confirmLabel: 'Apagar',
      tone: 'danger',
    });
    if (ok) remove.mutate(expense.id, { onSuccess: back });
  };

  return (
    <Screen
      nativeHeader
      title={title}
      onBack={back}
      headerRight={expense ? <HeaderButton icon="trash" accessibilityLabel="Apagar despesa" onPress={() => void del()} /> : undefined}
      footer={
        <Box gap="s8">
          {error ? (
            <Text variant="caption" color="danger">
              {errorMessage(error)}
            </Text>
          ) : null}
          <Button title="Salvar despesa" disabled={!valid} loading={save.isPending} onPress={submit} />
        </Box>
      }
    >
      <Box gap="s24">
        <TextField
          label="Descrição"
          value={description}
          onChangeText={setDescription}
          placeholder="Ex.: Aluguel do salão"
          maxLength={EXPENSE_DESCRIPTION_MAX}
          autoCapitalize="sentences"
        />
        <Box gap="s8">
          <Text variant="caption">Categoria</Text>
          <FilterChips
            accessibilityLabel="Categoria"
            chips={EXPENSE_CATEGORIES.map((c) => ({
              key: c.value,
              label: c.label,
              selected: category === c.value,
              onPress: () => setCategory(c.value),
            }))}
          />
        </Box>
        <TextField
          label="Valor"
          value={amount}
          onChangeText={(t) => setAmount(t.replace(/[^\d.,]/g, ''))}
          placeholder="350,00"
          keyboardType="decimal-pad"
          unit="R$"
          maxLength={14}
          errorMessage={amountError}
        />
        <TextField
          label="Data"
          value={date}
          onChangeText={(t) => setDate(maskBirthDate(t))}
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          maxLength={10}
          errorMessage={dateError}
        />
        <Card flexDirection="row" alignItems="center" gap="s12">
          <Icon name="refresh" color="textMuted" />
          <Box flex={1} gap="s4">
            <Text variant="bodyStrong">Repetir todo mês</Text>
            <Text variant="caption">Todo dia 1º, o lançamento do mês é criado com o mesmo valor. Dá para editar depois.</Text>
          </Box>
          <Switch
            value={repeats}
            onValueChange={setRepeats}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor={colors.text}
            ios_backgroundColor={colors.border}
            accessibilityLabel="Repetir todo mês"
          />
        </Card>
      </Box>
    </Screen>
  );
}
