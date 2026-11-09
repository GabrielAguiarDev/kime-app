import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { BeltSwatch, Box, Button, Card, EmptyState, FilterChips, Icon, LoadError, ProgressBar, Screen, Text } from '@components';
import {
  beltName,
  beltsOf,
  durationLabel,
  graduationSteps,
  modalityMilestones,
  monthlySeries,
  monthYearLabel,
  reportTotal,
  reportWeeklyAverage,
  useBelts,
  useClassReport,
  useModalities,
  type ClassReport,
  type GraduationStep,
  type Modality,
  type ModalityBelt,
} from '@domain/Classes';
import { useActiveGym } from '@services/activeGym';
import { useActiveModality } from '@services/activeModality';
import { useSession } from '@services/session';
import { useAppTheme } from '@theme';

import { MonthBars } from './MonthBars';

const aulas = (n: number) => `${n} ${n === 1 ? 'aula' : 'aulas'}`;
const decimal = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const perWeek = (n: number) => `${decimal(n)} ${n === 1 ? 'aula' : 'aulas'} por semana`;
/** "20 mar 2026" from a LocalDate. */
const dayLabel = (date: string) => `${Number(date.slice(8, 10))} ${monthYearLabel(date)}`;
const beltTitle = (belt: ModalityBelt | null) => (belt ? `Faixa ${beltName(belt).toLowerCase()}` : 'Fundamentos');

/**
 * Relatório de treinos (stack screen, native header with a large title), of
 * ONE modality:
 *  - own report (Perfil): the modality selected in the Início header, nothing
 *    else (user decision: no "Todas", no other modality);
 *  - staff (student detail, `userId` + `name` params): chips with the
 *    student's ACTIVE enrollments, starting on the first one.
 * Total, weekly average, classes per month, then the graduation timeline
 * (every step of the sequence) or, without belts, the milestones reached with
 * their dates; a shortcut to Competição when the student competes in it (own
 * report only). Numbers from class_report (the student or staff only).
 */
export function TrainingReportScreen() {
  const params = useLocalSearchParams<{ userId?: string; name?: string }>();
  const { userId: me } = useSession();
  const { active } = useActiveGym();
  const { selected: homeModality, isLoading: homeLoading } = useActiveModality();
  const academyId = active?.gymId;
  const userId = params.userId ?? me ?? undefined;
  const own = !params.userId || params.userId === me;
  const report = useClassReport(academyId, userId);
  const modalities = useModalities(academyId);
  const belts = useBelts(academyId);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const data = report.data;
  // Staff: the student's active enrollments, in the academy's order.
  const enrolled = useMemo(() => {
    if (!data) return [];
    const ids = new Set(data.enrollments.filter((e) => e.status === 'active').map((e) => e.modalityId));
    return (modalities.data ?? []).filter((m) => ids.has(m.id)).sort((a, b) => a.position - b.position);
  }, [data, modalities.data]);
  const modality: Modality | null = own
    ? (homeModality ?? null)
    : (enrolled.find((m) => m.id === pickedId) ?? enrolled[0] ?? null);

  const queries = [report, modalities, belts];
  const loading = homeLoading || queries.some((q) => q.isLoading);
  const failed = queries.filter((q) => q.isError);

  return (
    <Screen nativeHeader title="Relatório de treinos" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))}>
      {loading ? (
        <ActivityIndicator accessibilityLabel="Carregando" />
      ) : failed.length > 0 ? (
        <LoadError title="Não foi possível carregar o relatório" onRetry={() => failed.forEach((q) => void q.refetch())} />
      ) : !data ? (
        <EmptyState visual="icon" icon="chart" title="Relatório indisponível para esta conta." />
      ) : !modality ? (
        <EmptyState visual="icon" icon="chart" title={own ? 'Escolha uma modalidade no topo da Início.' : 'Este aluno não está em nenhuma modalidade.'} />
      ) : (
        <Box gap="s24">
          {!own && params.name ? <Text variant="heading">{params.name}</Text> : null}
          {!own && enrolled.length > 1 ? (
            <FilterChips
              accessibilityLabel="Modalidade do relatório"
              chips={enrolled.map((m) => ({
                key: m.id,
                label: m.name,
                selected: modality.id === m.id,
                onPress: () => setPickedId(m.id),
              }))}
            />
          ) : null}
          <ModalityReport
            report={data}
            modality={modality}
            belts={beltsOf(belts.data ?? [], modality.id)}
            competes={own && data.enrollments.some((e) => e.modalityId === modality.id && e.isCompetitor)}
          />
        </Box>
      )}
    </Screen>
  );
}

// ---------------------------------------------------------- modality ---

function ModalityReport({
  report,
  modality,
  belts,
  competes,
}: {
  report: ClassReport;
  modality: Modality;
  belts: ModalityBelt[];
  competes: boolean;
}) {
  const { select } = useActiveModality();
  const total = reportTotal(report, modality.id);
  const steps = modality.usesBelts ? graduationSteps(belts, report, modality.id) : [];
  const milestones = modalityMilestones(report, modality.id);

  return (
    <>
      <Box gap="s4" accessible accessibilityLabel={`${aulas(total)} confirmadas de ${modality.name}`}>
        <Text variant="displayXl">{total}</Text>
        <Text variant="body">{`Aulas confirmadas de ${modality.name}`}</Text>
      </Box>

      <Section title="Média semanal">
        <Stat label="Nos últimos 3 meses" value={perWeek(reportWeeklyAverage(report, modality.id))} last />
      </Section>

      <Section title="Aulas por mês">
        <MonthBars months={monthlySeries(report, modality.id)} />
      </Section>

      {modality.usesBelts ? (
        <Section title="Graduações">
          {steps.length === 0 ? (
            <Text variant="body" color="textMuted">
              A academia ainda não cadastrou as faixas desta modalidade.
            </Text>
          ) : (
            steps.map((step, i) => <TimelineStep key={step.key} step={step} first={i === 0} last={i === steps.length - 1} />)
          )}
        </Section>
      ) : (
        <Section title="Marcos alcançados">
          {milestones.length === 0 ? (
            <Text variant="body" color="textMuted">
              O primeiro marco é em 10 aulas.
            </Text>
          ) : (
            milestones.map((m, i) => (
              <Stat key={m.count} label={dayLabel(m.date)} value={aulas(m.count)} last={i === milestones.length - 1} />
            ))
          )}
        </Section>
      )}

      {competes ? (
        <Button
          title="Ver competição"
          variant="secondary"
          icon="trophy"
          onPress={() => {
            select(modality.id);
            router.push('/competition');
          }}
        />
      ) : null}
    </>
  );
}

/** Rail of the timeline: a marker per step joined by a vertical line. */
const RAIL = 24;
const MARKER = 20;

function TimelineStep({ step, first, last }: { step: GraduationStep; first: boolean; last: boolean }) {
  const { colors, border } = useAppTheme();
  const title = beltTitle(step.belt);
  const marker =
    step.state === 'done' ? (
      <Box width={MARKER} height={MARKER} style={{ borderRadius: MARKER / 2 }} backgroundColor="success" alignItems="center" justifyContent="center">
        <Icon name="done" color="bg" size={14} />
      </Box>
    ) : step.state === 'current' ? (
      <Box width={MARKER} height={MARKER} style={{ borderRadius: MARKER / 2 }} borderWidth={3} borderColor="accent" backgroundColor="bg" />
    ) : (
      <Box width={MARKER} height={MARKER} style={{ borderRadius: MARKER / 2 }} borderWidth={border.width} borderColor="textMuted" backgroundColor="bg" />
    );

  return (
    <Box flexDirection="row" gap="s12">
      <Box width={RAIL} alignItems="center">
        <Box style={{ width: border.width * 2, height: 14, backgroundColor: first ? 'transparent' : colors.border }} />
        {marker}
        <Box flex={1} style={{ width: border.width * 2, backgroundColor: last ? 'transparent' : colors.border }} />
      </Box>
      <Box flex={1} paddingBottom={last ? 'none' : 's16'}>
        {step.state === 'current' ? (
          <CurrentStep step={step} title={title} />
        ) : (
          <Box gap="s4" paddingTop="s12" accessible accessibilityLabel={stepLabel(step, title)}>
            <Box flexDirection="row" alignItems="center" gap="s8">
              {step.belt ? <BeltSwatch belt={step.belt} /> : null}
              <Text variant="bodyStrong" color={step.state === 'future' ? 'textMuted' : 'text'} numberOfLines={1} flex={1}>
                {title}
              </Text>
            </Box>
            {step.state === 'done' ? <DoneDetails step={step} /> : <FutureDetails step={step} />}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function DoneDetails({ step }: { step: GraduationStep }) {
  if (step.classes == null || !step.from || !step.to) {
    return <Text variant="caption">Concluída · sem aulas registradas nesta etapa</Text>;
  }
  return (
    <>
      <Text variant="caption" color="text">{`${aulas(step.classes)} · ${monthYearLabel(step.from)} – ${monthYearLabel(step.to)}`}</Text>
      <Text variant="caption">{`${durationLabel(step.from, step.to)} · ${perWeek(step.weeklyAverage ?? 0)}`}</Text>
    </>
  );
}

function FutureDetails({ step }: { step: GraduationStep }) {
  return (
    <Text variant="caption">{step.goal ? `Meta: ${aulas(step.goal)}` : 'Aulas não definidas'}</Text>
  );
}

function CurrentStep({ step, title }: { step: GraduationStep; title: string }) {
  const done = step.classes ?? 0;
  const since = step.from ? `Desde ${monthYearLabel(step.from)} · ${durationLabel(step.from, new Date().toISOString())}` : null;
  return (
    <Card selected gap="s12" accessible accessibilityLabel={`${title}, em andamento. ${step.goal ? `${done} de ${aulas(step.goal)}` : aulas(done)}`}>
      <Box flexDirection="row" alignItems="center" gap="s8">
        {step.belt ? <BeltSwatch belt={step.belt} /> : null}
        <Text variant="bodyStrong" numberOfLines={1} flex={1}>
          {title}
        </Text>
        <Text variant="caption" color="accent">
          em andamento
        </Text>
      </Box>
      {step.goal ? (
        <ProgressBar value={done} max={step.goal} unit="aulas" label={step.belt ? 'Até a próxima faixa' : 'Até a primeira faixa'} />
      ) : (
        <Text variant="caption" color="text">
          {step.belt ? `Faixa máxima · ${aulas(done)} nela` : `${aulas(done)} · aulas da próxima faixa não definidas`}
        </Text>
      )}
      {since ? <Text variant="caption">{since}</Text> : null}
    </Card>
  );
}

function stepLabel(step: GraduationStep, title: string) {
  if (step.state === 'future') return `${title}, bloqueada. ${step.goal ? `Meta de ${aulas(step.goal)}` : 'Aulas não definidas'}`;
  if (step.classes == null || !step.from || !step.to) return `${title}, concluída`;
  return `${title}, concluída. ${aulas(step.classes)} de ${monthYearLabel(step.from)} a ${monthYearLabel(step.to)}, ${durationLabel(step.from, step.to)}, ${perWeek(step.weeklyAverage ?? 0)}`;
}

// ------------------------------------------------------------ pieces ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box gap="s8">
      <Text variant="captionCaps" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </Box>
  );
}

/** A labeled number on a row (bottom border like the list rows). */
function Stat({ label, value, detail, last = false }: { label: string; value: string; detail?: string; last?: boolean }) {
  const { border } = useAppTheme();
  return (
    <Box
      flexDirection="row"
      alignItems="center"
      gap="s12"
      minHeight={52}
      style={{ paddingVertical: 8 }}
      borderBottomWidth={last ? 0 : border.width}
      borderColor="border"
      accessible
      accessibilityLabel={`${label}: ${value}${detail ? `, ${detail}` : ''}`}
    >
      <Box flex={1} gap="s4">
        <Text variant="body">{label}</Text>
        {detail ? <Text variant="caption">{detail}</Text> : null}
      </Box>
      <Text variant="bodyStrong">{value}</Text>
    </Box>
  );
}
