import { Box, Card, Icon, Text } from '@components';
import { formatMealTime, type DietMeal } from '@domain/Diet';
import { useAppTheme } from '@theme';

/** One meal: time, name and what to eat. Tappable for staff (edit). */
export function MealCard({ meal, onPress }: { meal: DietMeal; onPress?: () => void }) {
  const { size } = useAppTheme();
  const time = meal.mealTime ? formatMealTime(meal.mealTime) : null;
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${time ? `${time}, ` : ''}${meal.name}${meal.description ? `. ${meal.description}` : ''}`}
      flexDirection="row"
      gap="s12"
    >
      <Box minWidth={size.touchTarget}>
        <Text variant="counter" color={time ? 'text' : 'textMuted'}>
          {time ?? '—'}
        </Text>
      </Box>
      <Box flex={1} gap="s4">
        <Text variant="bodyStrong">{meal.name}</Text>
        {meal.description ? <Text variant="body">{meal.description}</Text> : null}
      </Box>
      {onPress ? <Icon name="edit" color="textMuted" /> : null}
    </Card>
  );
}
