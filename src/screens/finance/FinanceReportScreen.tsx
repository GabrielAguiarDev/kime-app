import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import { Box, Button, Card, LoadError, PersonList, PersonRow, Screen, Text } from '@components';
import { useAcademyToday, type LocalDate } from '@domain/Classes';
import {
  categoryLabel,
  financeService,
  formatMoney,
  monthCsv,
  monthOf,
  monthShort,
  monthTitle,
  useFinanceReport,
  type FinanceReport,
} from '@domain/Finance';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useAppTheme } from '@theme';

import { back, MoneyStat, MonthSwitcher, Section } from './parts';

const BAR_HEIGHT = 120;

/**
 * Perfil → Gestão → Financeiro → Relatórios (owner): month picker, the month
 * summary, the last 6 months, expenses by category, overdue rate and the
 * students with more than one month open; CSV export of the month.
 */
export function FinanceReportScreen() {
  const { active } = useActiveGym();
  const academyId = active?.gymId;
  const today = useAcademyToday(academyId);
  const [picked, setPicked] = useState<LocalDate | undefined>(undefined);
  const current = today.data ? monthOf(today.data) : undefined;
  const month = picked ?? current;

  if (!academyId || !month || !current || !today.data) {
    return (
      <Screen nativeHeader title="Relatórios" onBack={back}>
        {today.isError ? (
          <LoadError title="Não foi possível carregar o relatório" onRetry={() => void today.refetch()} />
        ) : (
          <ActivityIndicator accessibilityLabel="Carregando" />
        )}
      </Screen>
    );
  }
  return <Report academyId={academyId} month={month} current={current} today={today.data} onMonth={setPicked} />;
}

function Report({
  academyId,
  month,
  current,
  today,
  onMonth,
}: {
  academyId: string;
  month: LocalDate;
  current: LocalDate;
  today: LocalDate;
  onMonth: (m: LocalDate) => void;
}) {
  const report = useFinanceReport(academyId, month);
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const [charges, expenses] = await Promise.all([
        financeService.listMonthCharges(academyId, month),
        financeService.listExpenses(academyId, month),
      ]);
      const file = new File(Paths.cache, `kimi-financeiro-${month.slice(0, 7)}.csv`);
      file.create({ overwrite: true });
      file.write(monthCsv(charges, expenses, today));
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
        dialogTitle: `Financeiro · ${monthTitle(month)}`,
      });
    } catch (e) {
      Alert.alert('Exportar', errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen
      nativeHeader
      title="Relatórios"
      onBack={back}
      footer={<Button title="Exportar CSV" icon="share" loading={exporting} onPress={() => void exportCsv()} />}
    >
      <Box gap="s32">
        <MonthSwitcher month={month} max={current} onChange={onMonth} />
        {report.isLoading ? <ActivityIndicator accessibilityLabel="Carregando" /> : null}
        {report.isError ? (
          <LoadError title="Não foi possível carregar o relatório" onRetry={() => void report.refetch()} />
        ) : null}
        {report.data ? <ReportBody report={report.data} /> : null}
      </Box>
    </Screen>
  );
}

function ReportBody({ report }: { report: FinanceReport }) {
  return (
    <>
      <Section title="Resumo do mês">
        <Box flexDirection="row" gap="s12">
          <Box flex={1}>
            <Card>
              <MoneyStat label="Recebido" cents={report.receivedCents} color="success" />
            </Card>
          </Box>
          <Box flex={1}>
            <Card>
              <MoneyStat label="A receber" cents={report.receivableCents} />
            </Card>
          </Box>
        </Box>
        <Box flexDirection="row" gap="s12">
          <Box flex={1}>
            <Card>
              <MoneyStat label="Em atraso" cents={report.overdueCents} color={report.overdueCents > 0 ? 'danger' : 'text'} />
            </Card>
          </Box>
          <Box flex={1}>
            <Card>
              <MoneyStat label="Despesas" cents={report.expensesCents} />
            </Card>
          </Box>
        </Box>
        <Card>
          <MoneyStat
            label="Resultado · recebido menos despesas"
            cents={report.resultCents}
            color={report.resultCents < 0 ? 'danger' : 'success'}
          />
        </Card>
      </Section>

      <Section title="Últimos 6 meses">
        <HistoryBars history={report.history} />
      </Section>

      <Section title="Despesas por categoria">
        <Categories categories={report.categories} />
      </Section>

      <Section title="Inadimplência">
        <Lateness report={report} />
      </Section>
    </>
  );
}

/** Received × expenses per month, side by side; legend with text (color is never the only cue). */
function HistoryBars({ history }: { history: FinanceReport['history'] }) {
  const { border, borderRadii } = useAppTheme();
  const max = Math.max(1, ...history.flatMap((h) => [h.receivedCents, h.expensesCents]));
  const height = (cents: number) => (cents > 0 ? Math.max(2, Math.round((cents / max) * BAR_HEIGHT)) : 0);
  return (
    <Card gap="s16">
      <Box flexDirection="row" alignItems="flex-end" justifyContent="space-between" style={{ height: BAR_HEIGHT }}>
        {history.map((h) => (
          <Box
            key={h.month}
            flex={1}
            flexDirection="row"
            alignItems="flex-end"
            justifyContent="center"
            gap="s4"
            accessible
            accessibilityLabel={`${monthTitle(h.month)}: recebido ${formatMoney(h.receivedCents)}, despesas ${formatMoney(h.expensesCents)}`}
          >
            <Box width={12} backgroundColor="success" style={{ height: height(h.receivedCents), borderTopLeftRadius: borderRadii.sm / 2, borderTopRightRadius: borderRadii.sm / 2 }} />
            <Box width={12} backgroundColor="danger" style={{ height: height(h.expensesCents), borderTopLeftRadius: borderRadii.sm / 2, borderTopRightRadius: borderRadii.sm / 2 }} />
          </Box>
        ))}
      </Box>
      <Box flexDirection="row" borderTopWidth={border.width} borderColor="border" paddingTop="s8">
        {history.map((h) => (
          <Text key={h.month} variant="caption" flex={1} textAlign="center">
            {monthShort(h.month)}
          </Text>
        ))}
      </Box>
      <Box flexDirection="row" gap="s16" justifyContent="center">
        <Legend color="success" label="Receitas (recebido)" />
        <Legend color="danger" label="Despesas" />
      </Box>
    </Card>
  );
}

function Legend({ color, label }: { color: 'success' | 'danger'; label: string }) {
  return (
    <Box flexDirection="row" alignItems="center" gap="s8">
      <Box width={12} height={12} borderRadius="sm" backgroundColor={color} />
      <Text variant="caption">{label}</Text>
    </Box>
  );
}

function Categories({ categories }: { categories: FinanceReport['categories'] }) {
  if (categories.length === 0) {
    return (
      <Text variant="body" color="textMuted">
        Nenhuma despesa neste mês.
      </Text>
    );
  }
  const total = categories.reduce((sum, c) => sum + c.amountCents, 0);
  return (
    <Card gap="s16">
      {categories.map((c) => {
        const share = total > 0 ? c.amountCents / total : 0;
        return (
          <Box key={c.category} gap="s8">
            <Box flexDirection="row" justifyContent="space-between" gap="s12">
              <Text variant="bodyStrong">{categoryLabel(c.category)}</Text>
              <Text variant="bodyStrong">
                {formatMoney(c.amountCents)} <Text variant="caption">· {Math.round(share * 100)}%</Text>
              </Text>
            </Box>
            <Box height={8} borderRadius="sm" backgroundColor="border" overflow="hidden">
              <Box height={8} backgroundColor="danger" style={{ width: `${Math.max(share * 100, 1)}%` }} />
            </Box>
          </Box>
        );
      })}
    </Card>
  );
}

function Lateness({ report }: { report: FinanceReport }) {
  const rate = report.chargesCount > 0 ? Math.round((report.overdueCount / report.chargesCount) * 100) : null;
  return (
    <Box gap="s12">
      <Card gap="s4">
        <Text variant="captionCaps">Cobranças do mês atrasadas</Text>
        <Text variant="displayLg" color={rate ? 'danger' : 'text'}>
          {rate === null ? '–' : `${rate}%`}
        </Text>
        <Text variant="caption">
          {report.chargesCount === 0
            ? 'Nenhuma cobrança neste mês.'
            : `${report.overdueCount} de ${report.chargesCount} ${report.chargesCount === 1 ? 'cobrança' : 'cobranças'}`}
        </Text>
      </Card>
      <Text variant="caption">Alunos com mais de um mês em aberto</Text>
      {report.lateStudents.length === 0 ? (
        <Text variant="body" color="textMuted">
          Nenhum aluno com mais de um mês em aberto.
        </Text>
      ) : (
        <PersonList>
          {report.lateStudents.map((s, i) => (
            <PersonRow
              key={s.userId}
              name={s.fullName}
              avatarPath={s.avatarPath}
              last={i === report.lateStudents.length - 1}
              secondary={`${s.months} meses em aberto · ${formatMoney(s.amountCents)}`}
              onPress={
                s.membershipId
                  ? () => router.push({ pathname: '/member/[membershipId]', params: { membershipId: s.membershipId! } })
                  : undefined
              }
            />
          ))}
        </PersonList>
      )}
    </Box>
  );
}
