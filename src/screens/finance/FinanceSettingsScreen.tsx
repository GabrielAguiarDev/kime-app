import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Switch } from 'react-native';

import {
  BottomSheet,
  Box,
  Button,
  Card,
  Icon,
  LoadError,
  PersonList,
  Screen,
  Text,
  TextButton,
  TextField,
  WheelPicker,
  type IconName,
} from '@components';
import {
  DUE_DAYS,
  formatMoney,
  moneyToText,
  parseMoney,
  PLAN_NAME_MAX,
  useFinancePlans,
  useFinanceSettings,
  usePlanMutations,
  useSaveFinanceSettings,
  type FinancePlan,
} from '@domain/Finance';
import { errorMessage } from '@infra';
import { SheetForm } from '@screens/professor/shared';
import { useActiveGym } from '@services/activeGym';
import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

import { back, Section } from './parts';

/**
 * Perfil → Gestão → Financeiro (owner): on/off, then the plans, the default
 * due day, the block option and the links to charges, expenses and reports.
 */
export function FinanceSettingsScreen() {
  const { active } = useActiveGym();
  const academyId = active?.gymId;
  const settings = useFinanceSettings(academyId);

  if (!academyId || settings.isLoading) {
    return (
      <Screen nativeHeader title="Financeiro" onBack={back}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if (settings.isError || !settings.data) {
    return (
      <Screen nativeHeader title="Financeiro" onBack={back}>
        <LoadError title="Não foi possível carregar o financeiro" onRetry={() => void settings.refetch()} />
      </Screen>
    );
  }

  const { enabled, defaultDueDay, blockOverdue } = settings.data;
  return (
    <Screen nativeHeader title="Financeiro" onBack={back}>
      <Box gap="s32">
        <SettingSwitch
          academyId={academyId}
          field="enabled"
          value={enabled}
          icon="money"
          title="Financeiro da academia"
          description="Mensalidades, despesas e relatórios, só para você. O app não processa pagamentos."
        />

        {enabled ? (
          <>
            <Section title="Acompanhar">
              <LinkCard title="Cobranças em aberto" icon="clock" onPress={() => router.push('/financeiro/cobrancas')} />
              <LinkCard title="Despesas" icon="minus" onPress={() => router.push('/financeiro/despesas')} />
              <LinkCard title="Relatórios" icon="chart" onPress={() => router.push('/financeiro/relatorios')} />
            </Section>

            <PlansSection academyId={academyId} />

            <Section title="Cobrança">
              <DueDayCard academyId={academyId} value={defaultDueDay} />
              <SettingSwitch
                academyId={academyId}
                field="blockOverdue"
                value={blockOverdue}
                icon="locked"
                title="Bloquear aluno após 7 dias de atraso"
                description="Com a mensalidade vencida há mais de 7 dias, o aluno perde check-in, aulas, ranking, campeonatos e eventos até você marcar como paga. Água e widget continuam."
              />
            </Section>
          </>
        ) : null}
      </Box>
    </Screen>
  );
}

function SettingSwitch({
  academyId,
  field,
  value,
  icon,
  title,
  description,
}: {
  academyId: string;
  field: 'enabled' | 'blockOverdue';
  value: boolean;
  icon: IconName;
  title: string;
  description: string;
}) {
  const { colors } = useAppTheme();
  const save = useSaveFinanceSettings(academyId);
  return (
    <Card flexDirection="row" alignItems="center" gap="s12">
      <Icon name={icon} color="textMuted" />
      <Box flex={1} gap="s4">
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption">{description}</Text>
      </Box>
      <Switch
        value={value}
        onValueChange={(on) => {
          void haptics.tap();
          save.mutate({ [field]: on }, { onError: (e) => Alert.alert('Financeiro', errorMessage(e)) });
        }}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor={colors.text}
        ios_backgroundColor={colors.border}
        accessibilityLabel={title}
      />
    </Card>
  );
}

function LinkCard({ title, icon, onPress }: { title: string; icon: IconName; onPress: () => void }) {
  return (
    <Card onPress={onPress} accessibilityLabel={title} flexDirection="row" alignItems="center" gap="s12">
      <Icon name={icon} color="textMuted" />
      <Text variant="bodyStrong" flex={1}>
        {title}
      </Text>
      <Icon name="chevronRight" color="textMuted" />
    </Card>
  );
}

// ------------------------------------------------------------------ plans ---
function PlansSection({ academyId }: { academyId: string }) {
  const plans = useFinancePlans(academyId);
  /** undefined: closed; null: new plan. */
  const [editing, setEditing] = useState<FinancePlan | null | undefined>(undefined);
  const all = plans.data ?? [];
  const current = all.filter((p) => !p.archivedAt);
  const archived = all.filter((p) => p.archivedAt);

  return (
    <Section
      title="Planos de mensalidade"
      action={<TextButton title="Novo plano" icon="plus" fullWidth={false} onPress={() => setEditing(null)} />}
    >
      {plans.isLoading ? <ActivityIndicator /> : null}
      {plans.isError ? <LoadError title="Não foi possível carregar os planos" onRetry={() => void plans.refetch()} /> : null}
      {plans.data && current.length === 0 ? (
        <Text variant="body" color="textMuted">
          Nenhum plano ainda. Crie um, como “1 modalidade · R$ 150”.
        </Text>
      ) : null}
      {current.length > 0 ? <PlanList plans={current} onPress={setEditing} /> : null}
      {archived.length > 0 ? (
        <Box gap="s8">
          <Text variant="caption">Arquivados</Text>
          <PlanList plans={archived} onPress={setEditing} />
        </Box>
      ) : null}

      <BottomSheet visible={editing !== undefined} onRequestClose={() => setEditing(undefined)}>
        {editing !== undefined ? (
          <PlanSheet academyId={academyId} plan={editing} onDone={() => setEditing(undefined)} />
        ) : null}
      </BottomSheet>
    </Section>
  );
}

function PlanList({ plans, onPress }: { plans: FinancePlan[]; onPress: (p: FinancePlan) => void }) {
  const { border } = useAppTheme();
  return (
    <PersonList>
      {plans.map((p, i) => (
        <Pressable
          key={p.id}
          onPress={() => onPress(p)}
          accessibilityRole="button"
          accessibilityLabel={`${p.name}, ${formatMoney(p.amountCents)}. Editar`}
        >
          <Box
            minHeight={56}
            flexDirection="row"
            alignItems="center"
            gap="s12"
            borderBottomWidth={i === plans.length - 1 ? 0 : border.width}
            borderColor="border"
          >
            <Text variant="bodyStrong" flex={1} color={p.archivedAt ? 'textMuted' : 'text'} numberOfLines={1}>
              {p.name}
            </Text>
            <Text variant="bodyStrong" color={p.archivedAt ? 'textMuted' : 'text'}>
              {formatMoney(p.amountCents)}
            </Text>
            <Icon name="chevronRight" color="textMuted" />
          </Box>
        </Pressable>
      ))}
    </PersonList>
  );
}

function PlanSheet({ academyId, plan, onDone }: { academyId: string; plan: FinancePlan | null; onDone: () => void }) {
  const { save, archive } = usePlanMutations(academyId);
  const [name, setName] = useState(plan?.name ?? '');
  const [amount, setAmount] = useState(moneyToText(plan?.amountCents));
  const cents = parseMoney(amount);
  const amountError = amount.trim() && cents === null ? 'Use um valor como 150,00.' : undefined;
  const valid = name.trim().length > 0 && cents !== null;
  const error = save.error ?? archive.error;

  return (
    <SheetForm
      title={plan ? 'Editar plano' : 'Novo plano'}
      actions={
        <>
          {error ? (
            <Text variant="caption" color="danger">
              {errorMessage(error)}
            </Text>
          ) : null}
          <Button
            title="Salvar plano"
            disabled={!valid}
            loading={save.isPending}
            onPress={() =>
              cents !== null &&
              save.mutate({ id: plan?.id ?? null, name, amountCents: cents }, { onSuccess: onDone })
            }
          />
          {plan ? (
            <TextButton
              title={plan.archivedAt ? 'Reativar plano' : 'Arquivar plano'}
              color={plan.archivedAt ? 'accent' : 'danger'}
              disabled={archive.isPending}
              onPress={() => archive.mutate({ id: plan.id, archived: !plan.archivedAt }, { onSuccess: onDone })}
            />
          ) : null}
        </>
      }
    >
      <TextField
        label="Nome"
        value={name}
        onChangeText={setName}
        placeholder="Ex.: 1 modalidade"
        maxLength={PLAN_NAME_MAX}
        autoCapitalize="sentences"
      />
      <TextField
        label="Valor mensal"
        value={amount}
        onChangeText={(t) => setAmount(t.replace(/[^\d.,]/g, ''))}
        placeholder="150,00"
        keyboardType="decimal-pad"
        unit="R$"
        maxLength={12}
        errorMessage={amountError}
      />
      {plan && !plan.archivedAt ? (
        <Text variant="caption">Arquivado, o plano sai das opções de novos alunos. Quem já está nele continua sendo cobrado.</Text>
      ) : null}
    </SheetForm>
  );
}

// ---------------------------------------------------------------- due day ---
function DueDayCard({ academyId, value }: { academyId: string; value: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Card
        onPress={() => setOpen(true)}
        accessibilityLabel={`Dia padrão de vencimento: dia ${value}. Alterar`}
        flexDirection="row"
        alignItems="center"
        gap="s12"
      >
        <Icon name="calendar" color="textMuted" />
        <Box flex={1} gap="s4">
          <Text variant="bodyStrong">Dia padrão de vencimento</Text>
          <Text variant="caption">Vale para quem não tem um dia próprio.</Text>
        </Box>
        <Text variant="bodyStrong">Dia {value}</Text>
        <Icon name="chevronRight" color="textMuted" />
      </Card>
      <BottomSheet visible={open} onRequestClose={() => setOpen(false)}>
        {open ? <DueDaySheet academyId={academyId} value={value} onDone={() => setOpen(false)} /> : null}
      </BottomSheet>
    </>
  );
}

/** The day on a wheel (days only, 1–28); saved on "Salvar". */
function DueDaySheet({ academyId, value, onDone }: { academyId: string; value: number; onDone: () => void }) {
  const save = useSaveFinanceSettings(academyId);
  const [day, setDay] = useState(value);
  return (
    <SheetForm
      title="Dia padrão de vencimento"
      actions={
        <Button
          title="Salvar"
          onPress={() => {
            if (day !== value) {
              save.mutate({ defaultDueDay: day }, { onError: (e) => Alert.alert('Financeiro', errorMessage(e)) });
            }
            onDone();
          }}
        />
      }
    >
      <WheelPicker
        accessibilityLabel="Dia de vencimento"
        options={DUE_DAYS.map((d) => ({ value: d, label: String(d) }))}
        value={day}
        onChange={setDay}
      />
    </SheetForm>
  );
}
