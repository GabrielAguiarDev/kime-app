import { router } from 'expo-router';

import { Box, Card, Icon, Text } from '@components';
import { formatMoney, openChargesSummary, useFinanceSettings, useOpenCharges } from '@domain/Finance';
import { useAppTheme } from '@theme';

/**
 * Início (owner): "Mensalidades" while there are unpaid charges of this month
 * or earlier — total to receive, students pending and overdue. Gone when
 * everything is paid or the finance is off. Opens the open charges list.
 */
export function OwnerFinanceCard({ academyId }: { academyId: string }) {
  const { size } = useAppTheme();
  const settings = useFinanceSettings(academyId);
  const enabled = !!settings.data?.enabled;
  const charges = useOpenCharges(academyId, enabled);
  const list = charges.data ?? [];
  if (!enabled || list.length === 0) return null;

  const { totalCents, pendingStudents, overdueStudents } = openChargesSummary(list);
  const parts = [
    pendingStudents > 0 ? `${pendingStudents} ${pendingStudents === 1 ? 'pendente' : 'pendentes'}` : null,
    overdueStudents > 0 ? `${overdueStudents} ${overdueStudents === 1 ? 'atrasado' : 'atrasados'}` : null,
  ].filter(Boolean);

  return (
    <Card
      onPress={() => router.push('/financeiro/cobrancas')}
      accessibilityLabel={`Mensalidades: ${formatMoney(totalCents)} a receber, ${parts.join(', ')}. Abrir`}
      gap="s12"
    >
      <Box flexDirection="row" alignItems="center" gap="s8">
        <Icon name="money" color="textMuted" />
        <Text variant="captionCaps" flex={1}>
          Mensalidades
        </Text>
        <Icon name="chevronRight" color="textMuted" />
      </Box>
      <Box gap="s4">
        <Text variant="displayLg" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {formatMoney(totalCents)}
        </Text>
        <Text variant="caption">a receber</Text>
      </Box>
      <Box flexDirection="row" gap="s16">
        {pendingStudents > 0 ? (
          <Box flexDirection="row" alignItems="center" gap="s4">
            <Icon name="clock" color="warning" size={size.iconInline} />
            <Text variant="bodyStrong">
              {pendingStudents} {pendingStudents === 1 ? 'pendente' : 'pendentes'}
            </Text>
          </Box>
        ) : null}
        {overdueStudents > 0 ? (
          <Box flexDirection="row" alignItems="center" gap="s4">
            <Icon name="warning" color="danger" size={size.iconInline} />
            <Text variant="bodyStrong" color="danger">
              {overdueStudents} {overdueStudents === 1 ? 'atrasado' : 'atrasados'}
            </Text>
          </Box>
        ) : null}
      </Box>
    </Card>
  );
}
