import { router } from 'expo-router';
import type { ComponentType } from 'react';

import { Box, Card, EmptyState, Icon, Screen, Text } from '@components';
import { overdueNotice, useMyFinanceStatus } from '@domain/Finance';
import { useActiveGym } from '@services/activeGym';

/**
 * The student's own finance status (overdue months, block). Staff never get
 * one. The block itself is enforced by the database (RLS); this only decides
 * which screen to show instead of misleading empty lists.
 */
export function useMyFinance() {
  const { active, isStaff } = useActiveGym();
  const status = useMyFinanceStatus(active?.gymId, !!active && !isStaff);
  const data = isStaff ? null : (status.data ?? null);
  return {
    overdueMonths: data?.overdueMonths ?? [],
    blocked: data?.blocked ?? false,
  };
}

/** Início (student): "Sua mensalidade de novembro está em aberto. Fale com a academia." Never amounts. */
export function FinanceNotice() {
  const { overdueMonths } = useMyFinance();
  const text = overdueNotice(overdueMonths);
  if (!text) return null;
  return (
    <Card flexDirection="row" alignItems="center" gap="s12" accessibilityRole="text">
      <Icon name="info" color="textMuted" />
      <Text variant="body" flex={1}>
        {text}
      </Text>
    </Card>
  );
}

const RETURNS = 'Aulas, check-in, ranking, campeonatos e eventos voltam assim que a academia registrar o pagamento.';

/** In place of the blocked features (classes, check-in, ranking, championships, events). */
export function BlockedNotice({ compact = false }: { compact?: boolean }) {
  const { overdueMonths } = useMyFinance();
  const description = overdueNotice(overdueMonths) ?? 'Há uma mensalidade em aberto. Fale com a academia.';
  if (compact) {
    return (
      <Card gap="s8">
        <Box flexDirection="row" alignItems="center" gap="s8">
          <Icon name="locked" color="textMuted" />
          <Text variant="heading" flex={1}>
            Acesso pausado
          </Text>
        </Box>
        <Text variant="body" color="textMuted">
          {description} {RETURNS}
        </Text>
      </Card>
    );
  }
  return (
    <EmptyState
      title="Acesso pausado."
      description={`${description} ${RETURNS}`}
    />
  );
}

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

/**
 * Route wrapper: a blocked student sees the notice (with the screen's title)
 * instead of the screen. Everyone else gets the screen.
 */
export function withFinanceGate<P extends object>(Wrapped: ComponentType<P>, title: string, { tab = false } = {}) {
  function Gated(props: P) {
    const { blocked } = useMyFinance();
    if (!blocked) return <Wrapped {...props} />;
    return tab ? (
      <Screen nativeHeader title={title} bottomInset={false}>
        <BlockedNotice />
      </Screen>
    ) : (
      <Screen nativeHeader title={title} onBack={back}>
        <BlockedNotice />
      </Screen>
    );
  }
  Gated.displayName = `FinanceGate(${title})`;
  return Gated;
}
