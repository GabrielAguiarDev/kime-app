import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { BottomSheet, Box, Card, EmptyState, LoadError, PersonList, PersonRow, Screen, Text } from '@components';
import { useAcademyToday } from '@domain/Classes';
import {
  formatMoney,
  openChargesSummary,
  referenceLabel,
  useOpenCharges,
  type OpenCharge,
} from '@domain/Finance';
import { useActiveGym } from '@services/activeGym';

import { back, ChargeStatusBadge, MarkPaidSheet, MoneyStat } from './parts';

/**
 * Owner: unpaid charges of this month or earlier, most overdue first. Each row
 * marks the charge as paid (short sheet, already filled); confirmed, the row
 * leaves the list.
 */
export function OpenChargesScreen() {
  const { active } = useActiveGym();
  const academyId = active?.gymId;
  const charges = useOpenCharges(academyId);
  const today = useAcademyToday(academyId);
  const [paying, setPaying] = useState<OpenCharge | null>(null);

  if (!academyId || charges.isLoading || today.isLoading) {
    return (
      <Screen nativeHeader title="Mensalidades" onBack={back}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if (charges.isError || today.isError || !today.data) {
    return (
      <Screen nativeHeader title="Mensalidades" onBack={back}>
        <LoadError
          title="Não foi possível carregar as cobranças"
          onRetry={() => {
            void charges.refetch();
            void today.refetch();
          }}
        />
      </Screen>
    );
  }

  const list = charges.data ?? [];
  const summary = openChargesSummary(list);
  const todayDate = today.data;

  return (
    <Screen nativeHeader title="Mensalidades" onBack={back}>
      {list.length === 0 ? (
        <EmptyState title="Tudo pago." description="Nenhuma mensalidade em aberto." />
      ) : (
        <Box gap="s24">
          <Card gap="s8">
            <MoneyStat label="A receber" cents={summary.totalCents} align="center" />
            <Text variant="caption" textAlign="center">
              {countLabel(summary.pendingStudents, 'pendente', 'pendentes')} ·{' '}
              {countLabel(summary.overdueStudents, 'atrasado', 'atrasados')}
            </Text>
          </Card>
          <PersonList>
            {list.map((c, i) => (
              <PersonRow
                key={c.id}
                name={c.fullName}
                avatarPath={c.avatarPath}
                last={i === list.length - 1}
                secondary={
                  <Box flexDirection="row" alignItems="center" gap="s8" flexWrap="wrap">
                    <Text variant="caption">
                      {capitalize(referenceLabel(c.referenceMonth, todayDate))} · {formatMoney(c.amountCents)}
                    </Text>
                    <ChargeStatusBadge status={c.overdue ? 'overdue' : 'pending'} />
                  </Box>
                }
                onPress={
                  c.membershipId
                    ? () => router.push({ pathname: '/member/[membershipId]', params: { membershipId: c.membershipId! } })
                    : undefined
                }
                actions={[
                  {
                    icon: 'check',
                    label: `Marcar ${c.fullName}, ${referenceLabel(c.referenceMonth, todayDate)}, como paga`,
                    color: 'accent',
                    onPress: () => setPaying(c),
                  },
                ]}
              />
            ))}
          </PersonList>
        </Box>
      )}

      <BottomSheet visible={!!paying} onRequestClose={() => setPaying(null)}>
        {paying ? (
          <MarkPaidSheet
            academyId={academyId}
            today={todayDate}
            charge={{
              id: paying.id,
              amountCents: paying.amountCents,
              title: `${paying.fullName} · ${referenceLabel(paying.referenceMonth, todayDate)}`,
            }}
            onDone={() => setPaying(null)}
          />
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

function countLabel(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
