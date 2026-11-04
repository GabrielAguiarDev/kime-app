import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Box, Button, EmptyState, Screen, Text } from '@components';
import { addDays, weekStart, type LocalDate } from '@domain/Classes';
import { formatLocalDate } from '@domain/Competition';
import { daysWithMeals, mealsOn, useDietMeals } from '@domain/Diet';
import { useMyProfile } from '@domain/Profile';
import { localDate } from '@domain/Water';
import { useSession } from '@services/session';

import { DietWeekPicker } from './DietWeekPicker';
import { MealCard } from './MealCard';

/** Competitor: the diet the professor wrote, day by day (read-only). */
export function MyDietScreen() {
  const { userId } = useSession();
  const profile = useMyProfile(userId);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (profile.isLoading) {
    return (
      <Screen nativeHeader title="Dieta" onBack={back}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if (!profile.data || !userId) {
    return (
      <Screen nativeHeader title="Dieta" onBack={back}>
        <EmptyState
          visual="icon"
          icon="offline"
          title="Não foi possível carregar a dieta"
          action={<Button title="Tentar de novo" variant="secondary" onPress={() => void profile.refetch()} />}
        />
      </Screen>
    );
  }
  return <DietWeek userId={userId} today={localDate(new Date(), profile.data.timeZone)} onBack={back} />;
}

function DietWeek({ userId, today, onBack }: { userId: string; today: LocalDate; onBack: () => void }) {
  const [monday, setMonday] = useState(weekStart(today));
  const [selected, setSelected] = useState(today);
  const meals = useDietMeals(userId, monday, addDays(monday, 6));
  const ofDay = mealsOn(meals.data ?? [], selected);

  return (
    <Screen nativeHeader title="Dieta" onBack={onBack}>
      <Box gap="s24">
        <DietWeekPicker
          monday={monday}
          selected={selected}
          today={today}
          daysWithMeals={daysWithMeals(meals.data ?? [])}
          onSelect={setSelected}
          onChangeWeek={(next) => {
            setMonday(next);
            setSelected(next <= today && today <= addDays(next, 6) ? today : next);
          }}
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
              title="Sem dieta para este dia."
              description="O professor ainda não cadastrou refeições aqui."
            />
          ) : null}
          {ofDay.map((meal) => (
            <MealCard key={meal.id} meal={meal} />
          ))}
        </Box>
      </Box>
    </Screen>
  );
}
