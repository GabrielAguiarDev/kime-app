import { Pressable } from 'react-native';

import { Box, Icon, Text } from '@components';
import { addDays, WEEKDAY_LABELS, weekdayOf, type LocalDate } from '@domain/Classes';
import { formatLocalDate } from '@domain/Competition';
import { useAppTheme } from '@theme';

/** "10 a 16 nov" */
function weekLabel(monday: LocalDate): string {
  const sunday = addDays(monday, 6);
  const [, , d1] = monday.split('-');
  const end = formatLocalDate(sunday).replace(/ \d{4}$/, '');
  return `${Number(d1)} a ${end}`;
}

/**
 * Week navigation (previous / next) and the seven days, Monday first. The
 * selected day gets the accent; days with meals are in `text`, empty ones in
 * `textMuted`; today is marked.
 */
export function DietWeekPicker({
  monday,
  selected,
  today,
  daysWithMeals,
  onSelect,
  onChangeWeek,
}: {
  monday: LocalDate;
  selected: LocalDate;
  today: LocalDate;
  daysWithMeals: Set<LocalDate>;
  onSelect: (date: LocalDate) => void;
  onChangeWeek: (monday: LocalDate) => void;
}) {
  const theme = useAppTheme();
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const arrow = (direction: -1 | 1) => (
    <Pressable
      onPress={() => onChangeWeek(addDays(monday, 7 * direction))}
      accessibilityRole="button"
      accessibilityLabel={direction < 0 ? 'Semana anterior' : 'Próxima semana'}
      hitSlop={theme.spacing.s8}
      style={{ width: theme.size.touchTarget, height: theme.size.touchTarget, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={direction < 0 ? 'chevronLeft' : 'chevronRight'} color="textMuted" />
    </Pressable>
  );

  return (
    <Box gap="s8">
      <Box flexDirection="row" alignItems="center" justifyContent="space-between">
        {arrow(-1)}
        <Text variant="bodyStrong">{weekLabel(monday)}</Text>
        {arrow(1)}
      </Box>
      <Box flexDirection="row" gap="s4" accessibilityRole="tablist">
        {days.map((date) => {
          const isSelected = date === selected;
          const hasMeals = daysWithMeals.has(date);
          const isToday = date === today;
          const label = WEEKDAY_LABELS[weekdayOf(date)];
          return (
            <Pressable
              key={date}
              onPress={() => onSelect(date)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${label.long}, ${formatLocalDate(date)}${isToday ? ', hoje' : ''}${
                hasMeals ? '' : ', sem refeições'
              }`}
              style={{ flex: 1 }}
            >
              <Box
                alignItems="center"
                paddingVertical="s8"
                borderRadius="sm"
                borderWidth={theme.border.width}
                borderColor={isSelected ? 'accent' : 'border'}
                backgroundColor={isSelected ? 'accentSelected' : undefined}
                minHeight={theme.size.touchTarget}
              >
                <Text variant="caption" color={isSelected ? 'accent' : 'textMuted'}>
                  {isToday ? 'Hoje' : label.short}
                </Text>
                <Text variant="bodyStrong" color={isSelected ? 'accent' : hasMeals ? 'text' : 'textMuted'}>
                  {Number(date.slice(8))}
                </Text>
              </Box>
            </Pressable>
          );
        })}
      </Box>
    </Box>
  );
}
