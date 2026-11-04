import type { ReactNode } from 'react';

import { Box, Card, Icon, Text, type IconName } from '@components';
import { WEEK_ORDER, WEEKDAY_LABELS, weekdayOf, type LocalDate } from '@domain/Classes';
import {
  formatKg,
  formatShortDate,
  sortWeights,
  weightDelta,
  type WaterPlan,
  type WeightLog,
} from '@domain/Competition';
import { formatMl } from '@screens/water/format';

/** Tappable row with an icon and a chevron (sections of a screen). */
export function LinkRow({
  title,
  description,
  icon,
  onPress,
}: {
  title: string;
  description?: string;
  icon: IconName;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} accessibilityLabel={title} flexDirection="row" alignItems="center" gap="s12">
      <Icon name={icon} color="textMuted" />
      <Box flex={1} gap="s4">
        <Text variant="bodyStrong">{title}</Text>
        {description ? <Text variant="caption">{description}</Text> : null}
      </Box>
      <Icon name="chevronRight" color="textMuted" />
    </Card>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Box gap="s12">
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap="s12">
        <Text variant="captionCaps" flex={1}>
          {title}
        </Text>
        {action}
      </Box>
      {children}
    </Box>
  );
}

/**
 * Week of a water plan, Monday first. Days without a target show the automatic
 * goal (or "Meta automática" when unknown). `today` is highlighted.
 */
export function WaterPlanWeek({
  plan,
  today,
  autoGoalMl,
}: {
  plan: WaterPlan | null;
  today?: LocalDate;
  autoGoalMl?: number | null;
}) {
  const todayDow = today ? weekdayOf(today) : null;
  return (
    <Card gap="s12">
      {WEEK_ORDER.map((d) => {
        const target = plan?.targets[d] ?? null;
        const isToday = d === todayDow;
        return (
          <Box
            key={d}
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
            accessible
            accessibilityLabel={`${WEEKDAY_LABELS[d].long}${isToday ? ', hoje' : ''}: ${
              target ? `${formatMl(target)} ml do plano` : 'meta automática'
            }`}
          >
            <Text variant={isToday ? 'bodyStrong' : 'body'} color={isToday ? 'accent' : 'text'}>
              {WEEKDAY_LABELS[d].long}
              {isToday ? ' · hoje' : ''}
            </Text>
            {target ? (
              <Text variant="bodyStrong">{formatMl(target)} ml</Text>
            ) : (
              <Text variant="caption">
                {autoGoalMl ? `${formatMl(autoGoalMl)} ml · automática` : 'Meta automática'}
              </Text>
            )}
          </Box>
        );
      })}
    </Card>
  );
}

/** Latest weight, change from the previous weigh-in, and the history (newest first). */
export function WeightSummary({ logs }: { logs: WeightLog[] }) {
  const sorted = sortWeights(logs);
  const latest = sorted[0];
  const delta = weightDelta(logs);
  if (!latest) return null;
  return (
    <Card flexDirection="row" alignItems="flex-end" justifyContent="space-between" gap="s12">
      <Box>
        <Text variant="displayLg">
          {formatKg(latest.weightKg)}
          <Text variant="heading" color="textMuted">
            {' '}
            kg
          </Text>
        </Text>
        <Text variant="caption">Último peso · {formatShortDate(latest.loggedOn)}</Text>
      </Box>
      {delta !== null ? (
        <Text variant="bodyStrong" color="textMuted" accessibilityLabel={`Variação de ${formatKg(delta)} quilos`}>
          {delta > 0 ? '+' : ''}
          {formatKg(delta)} kg
        </Text>
      ) : null}
    </Card>
  );
}

export function WeightRow({ log, onPress }: { log: WeightLog; onPress?: () => void }) {
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${formatShortDate(log.loggedOn)}: ${formatKg(log.weightKg)} quilos`}
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
    >
      <Text variant="body">{formatShortDate(log.loggedOn)}</Text>
      <Box flexDirection="row" alignItems="center" gap="s8">
        <Text variant="bodyStrong">{formatKg(log.weightKg)} kg</Text>
        {onPress ? <Icon name="edit" color="textMuted" /> : null}
      </Box>
    </Card>
  );
}
