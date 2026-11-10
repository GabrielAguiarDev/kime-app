import { useState } from 'react';
import { ActivityIndicator, Pressable, Switch } from 'react-native';

import {
  BottomSheet,
  Box,
  Button,
  Card,
  Icon,
  LoadError,
  PersonList,
  SelectionCard,
  Text,
  TextField,
  WheelPicker,
} from '@components';
import { useAcademyToday, type LocalDate } from '@domain/Classes';
import { formatShortDate, toBrDate } from '@domain/Competition';
import {
  chargeStatus,
  DUE_DAYS,
  formatMoney,
  methodLabel,
  moneyToText,
  monthTitle,
  parseMoney,
  useFinancePlans,
  useFinanceSettings,
  usePaymentMutations,
  useSaveStudentBilling,
  useStudentBilling,
  useStudentCharges,
  type Charge,
  type FinancePlan,
  type StudentBilling,
} from '@domain/Finance';
import type { GymMember } from '@domain/Membership';
import { errorMessage } from '@infra';
import { SheetForm } from '@screens/professor/shared';
import { useConfirm } from '@services/confirm';
import { useAppTheme } from '@theme';

import { ChargeStatusBadge, MarkPaidSheet, Section } from './parts';

/**
 * Student detail (owner only, finance on): the monthly fee (plan or custom
 * amount, due day, exempt) and the charge history with status and payment date.
 */
export function StudentBillingSection({ academyId, member }: { academyId: string; member: GymMember }) {
  const settings = useFinanceSettings(academyId);
  if (!settings.data?.enabled) return null;
  return <BillingContent academyId={academyId} member={member} defaultDueDay={settings.data.defaultDueDay} />;
}

function BillingContent({ academyId, member, defaultDueDay }: { academyId: string; member: GymMember; defaultDueDay: number }) {
  const billing = useStudentBilling(member.id);
  const plans = useFinancePlans(academyId);
  const [editing, setEditing] = useState(false);

  const current = billing.data ?? null;
  const plan = current?.planId ? plans.data?.find((p) => p.id === current.planId) : undefined;
  const dueDay = current?.dueDay ?? defaultDueDay;
  const summary = current?.isExempt
    ? 'Isento'
    : current?.customAmountCents
      ? `Valor personalizado · ${formatMoney(current.customAmountCents)}`
      : plan
        ? `${plan.name} · ${formatMoney(plan.amountCents)}`
        : 'Sem plano';

  return (
    <Section title="Mensalidade">
      {billing.isLoading || plans.isLoading ? <ActivityIndicator /> : null}
      {billing.isError || plans.isError ? (
        <LoadError
          title="Não foi possível carregar a mensalidade"
          onRetry={() => {
            void billing.refetch();
            void plans.refetch();
          }}
        />
      ) : null}
      {billing.isSuccess && plans.isSuccess ? (
        <Card
          onPress={() => setEditing(true)}
          accessibilityLabel={`Mensalidade: ${summary}, vencimento dia ${dueDay}. Alterar`}
          flexDirection="row"
          alignItems="center"
          gap="s12"
        >
          <Icon name="money" color="textMuted" />
          <Box flex={1} gap="s4">
            <Text variant="bodyStrong">{summary}</Text>
            <Text variant="caption">
              {current?.isExempt
                ? 'Não gera cobranças.'
                : !current?.customAmountCents && !plan
                  ? 'Escolha um plano para gerar as cobranças.'
                  : `Vence todo dia ${dueDay}${current?.dueDay ? '' : ' (padrão da academia)'}`}
            </Text>
          </Box>
          <Icon name="edit" color="textMuted" />
        </Card>
      ) : null}

      <ChargeHistory academyId={academyId} userId={member.userId} name={member.fullName} />

      <BottomSheet visible={editing} onRequestClose={() => setEditing(false)}>
        {editing ? (
          <BillingSheet
            academyId={academyId}
            membershipId={member.id}
            billing={current}
            plans={plans.data ?? []}
            defaultDueDay={defaultDueDay}
            onDone={() => setEditing(false)}
          />
        ) : null}
      </BottomSheet>
    </Section>
  );
}

function BillingSheet({
  academyId,
  membershipId,
  billing,
  plans,
  defaultDueDay,
  onDone,
}: {
  academyId: string;
  membershipId: string;
  billing: StudentBilling | null;
  plans: FinancePlan[];
  defaultDueDay: number;
  onDone: () => void;
}) {
  const { colors } = useAppTheme();
  const save = useSaveStudentBilling(academyId);
  /** A plan id, 'custom' or null (none). */
  const [choice, setChoice] = useState<string | null>(
    billing?.customAmountCents ? 'custom' : (billing?.planId ?? null),
  );
  const [custom, setCustom] = useState(moneyToText(billing?.customAmountCents));
  const [dueDay, setDueDay] = useState<number | null>(billing?.dueDay ?? null);
  const [exempt, setExempt] = useState(billing?.isExempt ?? false);

  // Archived plans only show when the student is still on one.
  const options = plans.filter((p) => !p.archivedAt || p.id === billing?.planId);
  const customCents = parseMoney(custom);
  const customError = choice === 'custom' && custom.trim() && customCents === null ? 'Use um valor como 150,00.' : undefined;
  const valid = choice !== 'custom' || customCents !== null;

  const submit = () => {
    if (!valid) return;
    save.mutate(
      {
        membershipId,
        planId: choice && choice !== 'custom' ? choice : null,
        customAmountCents: choice === 'custom' ? customCents : null,
        dueDay,
        isExempt: exempt,
      },
      { onSuccess: onDone },
    );
  };

  return (
    <SheetForm
      title="Mensalidade"
      tall
      actions={
        <>
          {save.error ? (
            <Text variant="caption" color="danger">
              {errorMessage(save.error)}
            </Text>
          ) : null}
          <Button title="Salvar" disabled={!valid} loading={save.isPending} onPress={submit} />
        </>
      }
    >
      <Card flexDirection="row" alignItems="center" gap="s12">
        <Box flex={1} gap="s4">
          <Text variant="bodyStrong">Isento</Text>
          <Text variant="caption">Bolsista, familiar etc. Não gera cobranças.</Text>
        </Box>
        <Switch
          value={exempt}
          onValueChange={setExempt}
          trackColor={{ true: colors.accent, false: colors.border }}
          thumbColor={colors.text}
          ios_backgroundColor={colors.border}
          accessibilityLabel="Isento"
        />
      </Card>

      {!exempt ? (
        <>
          <Box gap="s8">
            <Text variant="caption">Plano</Text>
            {options.length === 0 ? (
              <Text variant="caption">Nenhum plano criado. Crie em Perfil → Financeiro, ou use um valor personalizado.</Text>
            ) : null}
            {options.map((p) => (
              <SelectionCard
                key={p.id}
                label={p.name}
                description={formatMoney(p.amountCents)}
                selected={choice === p.id}
                onPress={() => setChoice(p.id)}
              />
            ))}
            <SelectionCard label="Valor personalizado" selected={choice === 'custom'} onPress={() => setChoice('custom')} />
            {choice === 'custom' ? (
              <TextField
                label="Valor mensal"
                value={custom}
                onChangeText={(t) => setCustom(t.replace(/[^\d.,]/g, ''))}
                placeholder="150,00"
                keyboardType="decimal-pad"
                unit="R$"
                maxLength={12}
                errorMessage={customError}
              />
            ) : null}
          </Box>

          <Box gap="s8">
            <Text variant="caption">Dia de vencimento</Text>
            <WheelPicker
              accessibilityLabel="Dia de vencimento"
              options={[
                // 0 = the academy default.
                { value: 0, label: `Padrão (dia ${defaultDueDay})` },
                ...DUE_DAYS.map((d) => ({ value: d, label: String(d) })),
              ]}
              value={dueDay ?? 0}
              onChange={(d) => setDueDay(d === 0 ? null : d)}
            />
          </Box>
        </>
      ) : null}
      <Text variant="caption">As mudanças valem a partir da próxima cobrança, no dia 1º.</Text>
    </SheetForm>
  );
}

// ---------------------------------------------------------------- history ---
function ChargeHistory({ academyId, userId, name }: { academyId: string; userId: string; name: string }) {
  const today = useAcademyToday(academyId);
  const charges = useStudentCharges(academyId, userId);
  const { undo } = usePaymentMutations(academyId);
  const confirm = useConfirm();
  const [paying, setPaying] = useState<Charge | null>(null);

  if (charges.isLoading || today.isLoading) return <ActivityIndicator />;
  if (charges.isError || today.isError || !today.data) {
    return (
      <LoadError
        title="Não foi possível carregar as cobranças"
        onRetry={() => {
          void charges.refetch();
          void today.refetch();
        }}
      />
    );
  }
  const list = charges.data ?? [];
  const todayDate = today.data;
  if (list.length === 0) {
    return (
      <Text variant="body" color="textMuted">
        Nenhuma cobrança ainda. Elas são criadas todo dia 1º.
      </Text>
    );
  }

  const undoPayment = async (c: Charge) => {
    const ok = await confirm({
      title: 'Desfazer pagamento?',
      message: `A mensalidade de ${monthTitle(c.referenceMonth).toLowerCase()} volta a ficar em aberto.`,
      confirmLabel: 'Desfazer',
      tone: 'danger',
    });
    if (ok) undo.mutate(c.id);
  };

  return (
    <Box gap="s8">
      <Text variant="caption">Histórico de cobranças</Text>
      {undo.error ? (
        <Text variant="caption" color="danger">
          {errorMessage(undo.error)}
        </Text>
      ) : null}
      <PersonList>
        {list.map((c, i) => (
          <ChargeRow
            key={c.id}
            charge={c}
            today={todayDate}
            last={i === list.length - 1}
            onPress={() => (c.paidOn ? void undoPayment(c) : setPaying(c))}
          />
        ))}
      </PersonList>

      <BottomSheet visible={!!paying} onRequestClose={() => setPaying(null)}>
        {paying ? (
          <MarkPaidSheet
            academyId={academyId}
            today={todayDate}
            charge={{ id: paying.id, amountCents: paying.amountCents, title: `${name} · ${monthTitle(paying.referenceMonth).toLowerCase()}` }}
            onDone={() => setPaying(null)}
          />
        ) : null}
      </BottomSheet>
    </Box>
  );
}

function ChargeRow({ charge, today, last, onPress }: { charge: Charge; today: LocalDate; last: boolean; onPress: () => void }) {
  const { border, spacing } = useAppTheme();
  const status = chargeStatus(charge, today);
  const method = methodLabel(charge.paymentMethod);
  const detail = charge.paidOn
    ? [`Paga em ${toBrDate(charge.paidOn)}`, method, charge.paidAmountCents !== charge.amountCents && charge.paidAmountCents !== null ? `recebido ${formatMoney(charge.paidAmountCents)}` : null]
        .filter(Boolean)
        .join(' · ')
    : `Vence ${formatShortDate(charge.dueDate)}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${monthTitle(charge.referenceMonth)}, ${formatMoney(charge.amountCents)}, ${detail}. ${charge.paidOn ? 'Desfazer pagamento' : 'Marcar como paga'}`}
    >
      <Box
        flexDirection="row"
        alignItems="center"
        gap="s12"
        style={{ paddingVertical: spacing.s12 }}
        borderBottomWidth={last ? 0 : border.width}
        borderColor="border"
      >
        <Box flex={1} gap="s4">
          <Text variant="bodyStrong">
            {monthTitle(charge.referenceMonth)} · {formatMoney(charge.amountCents)}
          </Text>
          <Text variant="caption">{detail}</Text>
        </Box>
        <ChargeStatusBadge status={status} />
      </Box>
    </Pressable>
  );
}
