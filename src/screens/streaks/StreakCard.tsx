import { Box, Card, Icon, Text, type IconName } from '@components';
import { WEEKDAY_LABELS, weekdayOf } from '@domain/Classes';
import { streakUnit, type PeriodState, type Streak, type StreakRule } from '@domain/Streaks';
import type { ColorToken } from '@theme';

/** How many recent periods the strip shows. */
const STRIP = 7;

const STATE_ICON: Record<PeriodState, { icon: IconName; color: ColorToken; active: boolean; label: string }> = {
  done: { icon: 'flame', color: 'accent', active: true, label: 'cumprido' },
  frozen: { icon: 'freeze', color: 'water', active: true, label: 'congelado' },
  missed: { icon: 'missed', color: 'textMuted', active: false, label: 'perdido' },
  open: { icon: 'open', color: 'textMuted', active: false, label: 'em aberto' },
};

/**
 * One streak ("ofensiva"): flame + count, today's state, freezes in stock,
 * record and the last periods (flame, ice, miss, open).
 *  - flame lit (accent, filled): the current day/week is done;
 *  - flame outline: streak alive, still to do today/this week;
 *  - flame off (disabled): no streak.
 */
export function StreakCard({
  title,
  unit,
  streak,
  rule,
  doneText,
  pendingText,
  emptyText,
}: {
  title: string;
  unit: 'day' | 'week';
  streak: Streak;
  rule: StreakRule;
  doneText: string;
  pendingText: string;
  emptyText: string;
}) {
  const { current, record, freezes, currentDone } = streak;
  const lit = current > 0 || currentDone;
  const recent = streak.periods.slice(-STRIP);
  const status = currentDone ? doneText : current > 0 ? pendingText : emptyText;
  const unitCaps = `${streakUnit(current, unit)} seguid${unit === 'day' ? 'o' : 'a'}${current === 1 ? '' : 's'}`;

  return (
    <Card gap="s16">
      <Text variant="captionCaps">{title}</Text>
      <Box
        flexDirection="row"
        alignItems="center"
        gap="s12"
        accessible
        accessibilityLabel={`${current} ${unitCaps}. ${status}`}
      >
        {/* TODO(motion): flame lighting up when the day/week is completed. */}
        <Icon name="flame" color={lit ? 'accent' : 'disabled'} active={currentDone} />
        <Text variant="displayLg">{current}</Text>
        <Text variant="captionCaps" flex={1}>
          {unitCaps}
        </Text>
      </Box>
      <Text variant="body" color={currentDone ? 'success' : 'textMuted'}>
        {status}
      </Text>

      {recent.length > 0 ? (
        <Box flexDirection="row" justifyContent="space-between">
          {recent.map((p) => {
            const look = STATE_ICON[p.state];
            const label = unit === 'day' ? WEEKDAY_LABELS[weekdayOf(p.key)].short : `${p.key.slice(8)}/${p.key.slice(5, 7)}`;
            return (
              <Box key={p.key} alignItems="center" gap="s4" accessible accessibilityLabel={`${label}: ${look.label}`}>
                <Icon name={look.icon} color={look.color} active={look.active} />
                <Text variant="caption">{label}</Text>
              </Box>
            );
          })}
        </Box>
      ) : null}

      <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap="s12">
        <Box
          flexDirection="row"
          alignItems="center"
          gap="s4"
          accessible
          accessibilityLabel={`${freezes} de ${rule.maxFreezes} congelamentos guardados`}
        >
          {Array.from({ length: rule.maxFreezes }, (_, i) => (
            <Icon key={i} name="freeze" color={i < freezes ? 'water' : 'disabled'} active={i < freezes} />
          ))}
          <Text variant="caption">
            {freezes} {freezes === 1 ? 'congelamento' : 'congelamentos'}
          </Text>
        </Box>
        <Text variant="caption">
          Recorde: {record} {streakUnit(record, unit)}
        </Text>
      </Box>
    </Card>
  );
}
