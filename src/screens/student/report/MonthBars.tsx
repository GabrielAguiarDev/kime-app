import { View } from 'react-native';

import { Box, Text } from '@components';
import { monthShortLabel, monthYearLabel, type MonthCount } from '@domain/Classes';
import { useAppTheme } from '@theme';

const BAR_AREA = 96;
/** Rounded data end (top), anchored on the baseline; 2px surface gap between bars. */
const BAR_RADIUS = 4;
const BAR_GAP = 2;

/**
 * Classes per month as simple bars (one series, accent): thin bars rounded at
 * the top on a recessive baseline, the month initials below and only the peak
 * labeled with its value. The whole series is read out as one accessibility
 * label (the table view of a native screen).
 */
export function MonthBars({ months }: { months: MonthCount[] }) {
  const { colors, border } = useAppTheme();
  const max = Math.max(0, ...months.map((m) => m.classes));
  const peak = max > 0 ? months.reduce((best, m) => (m.classes >= best.classes ? m : best), months[0]!) : null;
  const label = months.map((m) => `${monthYearLabel(m.month)}: ${m.classes}`).join(', ');

  if (max === 0) {
    return (
      <Text variant="body" color="textMuted">
        Nenhuma aula confirmada nos últimos 12 meses.
      </Text>
    );
  }

  return (
    <Box accessible accessibilityLabel={`Aulas por mês. ${label}`}>
      <Box flexDirection="row" alignItems="flex-end" style={{ height: BAR_AREA + 20, gap: BAR_GAP }}>
        {months.map((m) => {
          const height = max > 0 ? Math.max(m.classes > 0 ? 3 : 0, (m.classes / max) * BAR_AREA) : 0;
          return (
            <Box key={m.month} flex={1} alignItems="center" justifyContent="flex-end" style={{ height: BAR_AREA + 20 }}>
              {peak && m.month === peak.month ? (
                <Text variant="caption" color="text" style={{ marginBottom: 2 }}>
                  {m.classes}
                </Text>
              ) : null}
              <View
                style={{
                  width: '72%',
                  height,
                  backgroundColor: colors.accent,
                  borderTopLeftRadius: BAR_RADIUS,
                  borderTopRightRadius: BAR_RADIUS,
                }}
              />
            </Box>
          );
        })}
      </Box>
      <View style={{ height: border.width, backgroundColor: colors.border }} />
      <Box flexDirection="row" marginTop="s4" style={{ gap: BAR_GAP }}>
        {months.map((m) => (
          <Text key={m.month} variant="caption" flex={1} textAlign="center" numberOfLines={1}>
            {monthShortLabel(m.month).charAt(0).toUpperCase()}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
