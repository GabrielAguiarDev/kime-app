import { useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import { BottomSheet, Box, Button, EmptyState, Screen, Text, TextButton } from '@components';
import { addDays, useAcademyToday, weekStart, type LocalDate } from '@domain/Classes';
import { formatLocalDate } from '@domain/Competition';
import { daysWithMeals, mealsOn, useDietMeals, useDietMutations, type DietMeal } from '@domain/Diet';
import { errorMessage } from '@infra';
import { useAthlete } from '@screens/competition/useAthlete';
import { useConfirm } from '@services/confirm';
import { haptics } from '@utils/haptics';

import { DietWeekPicker } from './DietWeekPicker';
import { MealCard } from './MealCard';
import { MealForm } from './MealForm';

/**
 * Staff: daily diet of a competitor. Pick a day of the week; add, edit and
 * remove meals; an empty day can copy the day before.
 */
export function AthleteDietScreen() {
  const { academyId, member, isLoading, notCompetitor, back } = useAthlete();
  const today = useAcademyToday(academyId);

  if (isLoading || today.isLoading) {
    return (
      <Screen nativeHeader title="Dieta" onBack={back}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if (notCompetitor || !member || !academyId) {
    return (
      <Screen nativeHeader title="Dieta" onBack={back}>
        <EmptyState title="Este aluno não está na equipe." description="Só atletas da equipe de competição têm dieta." />
      </Screen>
    );
  }
  if (!today.data) {
    return (
      <Screen nativeHeader title="Dieta" onBack={back}>
        <EmptyState
          visual="icon"
          icon="offline"
          title="Não foi possível carregar a dieta"
          action={<Button title="Tentar de novo" variant="secondary" onPress={() => void today.refetch()} />}
        />
      </Screen>
    );
  }
  return (
    <DietEditor
      academyId={academyId}
      athleteId={member.userId}
      athleteName={member.fullName}
      today={today.data}
      onBack={back}
    />
  );
}

type SheetState = { mode: 'new' } | { mode: 'edit'; meal: DietMeal } | null;

function DietEditor({
  academyId,
  athleteId,
  athleteName,
  today,
  onBack,
}: {
  academyId: string;
  athleteId: string;
  athleteName: string;
  today: LocalDate;
  onBack: () => void;
}) {
  const [monday, setMonday] = useState(weekStart(today));
  const [selected, setSelected] = useState(today);
  const [sheet, setSheet] = useState<SheetState>(null);
  const confirm = useConfirm();
  // One day on each side of the week: "Copiar do dia anterior" on Monday and
  // "Repetir amanhã" on Sunday know whether that day has meals.
  const meals = useDietMeals(athleteId, addDays(monday, -1), addDays(monday, 7));
  const { save, remove, copyDay } = useDietMutations(academyId, athleteId);

  const all = meals.data ?? [];
  const ofDay = mealsOn(all, selected, academyId);
  const previous = addDays(selected, -1);
  const previousCount = mealsOn(all, previous, academyId).length;

  const changeWeek = (next: LocalDate) => {
    setMonday(next);
    // Keep the same weekday in the new week.
    setSelected(addDays(next, Math.round((Date.parse(selected) - Date.parse(monday)) / 86_400_000)));
  };

  const del = async (meal: DietMeal) => {
    setSheet(null);
    const ok = await confirm({
      title: 'Remover refeição?',
      message: `${meal.name} sai da dieta de ${formatLocalDate(meal.planDate)}.`,
      confirmLabel: 'Remover',
      tone: 'danger',
    });
    if (ok) remove.mutate(meal.id, { onError: (e) => Alert.alert('Dieta', errorMessage(e)) });
  };

  return (
    <Screen
      nativeHeader
      title="Dieta"
      onBack={onBack}
      footer={<Button title="Adicionar refeição" icon="plus" onPress={() => setSheet({ mode: 'new' })} />}
    >
      <Box gap="s24">
        <Text variant="body" color="textMuted">
          Refeições de {athleteName} para cada dia.
        </Text>
        <DietWeekPicker
          monday={monday}
          selected={selected}
          today={today}
          marked={daysWithMeals(all.filter((m) => m.academyId === academyId))}
          onSelect={setSelected}
          onChangeWeek={changeWeek}
        />

        <Box gap="s12">
          <Text variant="captionCaps">{formatLocalDate(selected)}</Text>
          {meals.isLoading ? <ActivityIndicator /> : null}
          {meals.isError ? (
            <EmptyState
              visual="icon"
              icon="offline"
              title="Não foi possível carregar as refeições"
              action={<Button title="Tentar de novo" variant="secondary" onPress={() => void meals.refetch()} />}
            />
          ) : null}
          {meals.data && ofDay.length === 0 ? (
            <EmptyState
              visual="icon"
              icon="diet"
              title="Nenhuma refeição neste dia."
              action={
                previousCount > 0 ? (
                  <Button
                    title="Copiar do dia anterior"
                    variant="secondary"
                    icon="copy"
                    loading={copyDay.isPending}
                    onPress={() =>
                      copyDay.mutate(
                        { from: previous, to: selected },
                        {
                          onSuccess: () => haptics.success(),
                          onError: (e) => Alert.alert('Dieta', errorMessage(e)),
                        },
                      )
                    }
                  />
                ) : undefined
              }
            />
          ) : null}
          {ofDay.map((meal) => (
            <MealCard key={meal.id} meal={meal} onPress={() => setSheet({ mode: 'edit', meal })} />
          ))}
        </Box>
        {ofDay.length > 0 ? (
          <TextButton
            title={`Repetir este dia amanhã (${formatLocalDate(addDays(selected, 1))})`}
            icon="copy"
            disabled={copyDay.isPending}
            onPress={async () => {
              const next = addDays(selected, 1);
              const nextHasMeals = mealsOn(all, next, academyId).length > 0;
              if (nextHasMeals) {
                const ok = await confirm({
                  title: 'Substituir o dia seguinte?',
                  message: `As refeições de ${formatLocalDate(next)} serão trocadas pelas deste dia.`,
                  confirmLabel: 'Substituir',
                });
                if (!ok) return;
              }
              copyDay.mutate(
                { from: selected, to: next },
                {
                  onSuccess: () => {
                    haptics.success();
                    setMonday(weekStart(next));
                    setSelected(next);
                  },
                  onError: (e) => Alert.alert('Dieta', errorMessage(e)),
                },
              );
            }}
          />
        ) : null}
      </Box>

      <BottomSheet visible={!!sheet} onRequestClose={() => setSheet(null)}>
        {sheet ? (
          <MealForm
            key={sheet.mode === 'edit' ? sheet.meal.id : 'new'}
            title={sheet.mode === 'edit' ? 'Editar refeição' : 'Nova refeição'}
            initial={sheet.mode === 'edit' ? sheet.meal : undefined}
            saving={save.isPending}
            error={save.error}
            onDelete={sheet.mode === 'edit' ? () => del(sheet.meal) : undefined}
            onSave={(input) =>
              save.mutate(
                { date: selected, mealId: sheet.mode === 'edit' ? sheet.meal.id : null, input },
                {
                  onSuccess: () => {
                    haptics.success();
                    setSheet(null);
                  },
                },
              )
            }
          />
        ) : null}
      </BottomSheet>
    </Screen>
  );
}
