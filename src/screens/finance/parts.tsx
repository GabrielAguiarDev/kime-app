import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable } from 'react-native';

import { Box, Button, FilterChips, Icon, StatusBadge, Text, TextField } from '@components';
import type { LocalDate } from '@domain/Classes';
import { parseBrDate, toBrDate } from '@domain/Competition';
import {
  addMonths,
  formatMoney,
  moneyToText,
  monthTitle,
  parseMoney,
  PAYMENT_METHODS,
  statusLabel,
  usePaymentMutations,
  type ChargeStatus,
  type PaymentMethod,
} from '@domain/Finance';
import { maskBirthDate } from '@domain/Profile';
import { errorMessage } from '@infra';
import { SheetForm } from '@screens/professor/shared';
import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

export const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** Pendente (warning), Atrasada (danger), Paga (success): icon + text, never color alone. */
export function ChargeStatusBadge({ status }: { status: ChargeStatus }) {
  if (status === 'paid') return <StatusBadge status="confirmed" label={statusLabel(status)} />;
  if (status === 'overdue') return <StatusBadge status="rejected" icon="warning" label={statusLabel(status)} />;
  return <StatusBadge status="pending" label={statusLabel(status)} />;
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Box gap="s12">
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap="s12">
        <Text variant="captionCaps" accessibilityRole="header">
          {title}
        </Text>
        {action}
      </Box>
      {children}
    </Box>
  );
}

/** "‹ Novembro de 2026 ›": never past the current month. */
export function MonthSwitcher({ month, max, onChange }: { month: LocalDate; max: LocalDate; onChange: (m: LocalDate) => void }) {
  const { size } = useAppTheme();
  const canNext = month < max;
  const arrow = (icon: 'chevronLeft' | 'chevronRight', label: string, enabled: boolean, to: LocalDate) => (
    <Pressable
      onPress={() => onChange(to)}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      style={{ width: size.touchTarget, height: size.touchTarget, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} color={enabled ? 'text' : 'disabled'} />
    </Pressable>
  );
  return (
    <Box flexDirection="row" alignItems="center" justifyContent="space-between">
      {arrow('chevronLeft', 'Mês anterior', true, addMonths(month, -1))}
      <Text variant="heading" accessibilityLiveRegion="polite">
        {monthTitle(month)}
      </Text>
      {arrow('chevronRight', 'Próximo mês', canNext, addMonths(month, 1))}
    </Box>
  );
}

/** Short "mark as paid" form, already filled: today, no method, the charge amount. */
export function MarkPaidSheet({
  academyId,
  charge,
  today,
  onDone,
}: {
  academyId: string;
  charge: { id: string; amountCents: number; title: string };
  today: LocalDate;
  onDone: () => void;
}) {
  const { markPaid } = usePaymentMutations(academyId, {
    onPaid: () => void haptics.success(),
    onPayError: (e) => Alert.alert('Mensalidade', `${errorMessage(e)} O pagamento não foi registrado.`),
  });
  const [date, setDate] = useState(toBrDate(today));
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState(moneyToText(charge.amountCents));

  const paidOn = parseBrDate(date);
  const dateError =
    date.length === 10 && !paidOn
      ? 'Use uma data válida no formato DD/MM/AAAA.'
      : paidOn && paidOn > today
        ? 'A data não pode ser no futuro.'
        : undefined;
  const cents = parseMoney(amount, { allowZero: true });
  const amountError = amount.trim() && cents === null ? 'Use um valor como 150,00.' : undefined;
  const valid = !!paidOn && !dateError && cents !== null;

  const submit = () => {
    if (!valid || !paidOn || cents === null) return;
    markPaid.mutate({ chargeId: charge.id, input: { paidOn, method, paidAmountCents: cents } });
    // Optimistic: the row leaves the list on the tap; an error puts it back.
    onDone();
  };

  return (
    <SheetForm
      title="Marcar como paga"
      actions={
        <>
          <Button title="Marcar como paga" icon="check" disabled={!valid} onPress={submit} />
        </>
      }
    >
      <Text variant="body" color="textMuted">
        {charge.title} · {formatMoney(charge.amountCents)}
      </Text>
      <TextField
        label="Data do pagamento"
        value={date}
        onChangeText={(t) => setDate(maskBirthDate(t))}
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        maxLength={10}
        errorMessage={dateError}
      />
      <Box gap="s8">
        <Text variant="caption">Forma (opcional)</Text>
        <FilterChips
          accessibilityLabel="Forma de pagamento"
          chips={PAYMENT_METHODS.map((m) => ({
            key: m.value,
            label: m.label,
            selected: method === m.value,
            onPress: () => setMethod(method === m.value ? null : m.value),
          }))}
        />
      </Box>
      <TextField
        label="Valor recebido"
        value={amount}
        onChangeText={(t) => setAmount(t.replace(/[^\d.,]/g, ''))}
        keyboardType="decimal-pad"
        unit="R$"
        maxLength={12}
        errorMessage={amountError}
      />
    </SheetForm>
  );
}

/**
 * Money stat: label in caps above, the amount in `title` (values run into the
 * thousands, so not display-lg) with a smaller "R$"; shrinks to fit.
 */
export function MoneyStat({
  label,
  cents,
  color = 'text',
  align = 'flex-start',
}: {
  label: string;
  cents: number;
  color?: 'text' | 'success' | 'danger' | 'warning';
  align?: 'flex-start' | 'center';
}) {
  const amount = formatMoney(Math.abs(cents)).replace('R$ ', '');
  const value = `${cents < 0 ? '− ' : ''}R$ ${amount}`;
  return (
    <Box alignItems={align} gap="s4" accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="captionCaps">{label}</Text>
      {/* Two texts side by side (not nested: a nested smaller text sets the line height and clips the digits). */}
      <Box flexDirection="row" alignItems="baseline" gap="s4" maxWidth="100%">
        <Text variant="bodyStrong" color={color}>
          {cents < 0 ? '− R$' : 'R$'}
        </Text>
        <Text variant="title" color={color} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} flexShrink={1}>
          {amount}
        </Text>
      </Box>
    </Box>
  );
}
