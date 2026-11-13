import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable } from 'react-native';

import { BottomSheet, Box, Card, Icon, LoadError, Screen, Text, Spinner } from '@components';
import { addDays } from '@domain/Classes';
import {
  DISCIPLINE_RULE,
  useDiscipline,
  weekProgressText,
  weeksLabel,
  type Discipline,
  type DisciplineDay,
  type DisciplineWeekState,
} from '@domain/Streaks';
import { SheetForm } from '@screens/professor/shared';
import { useSession } from '@services/session';
import { useAppTheme, type ColorToken } from '@theme';

/** Closed weeks in the timeline. */
const TIMELINE = 8;
/** Monday first. */
const WEEK_LETTERS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const WEEK_NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const WEEK_LOOK: Record<DisciplineWeekState, { color: ColorToken; label: string }> = {
  done: { color: 'accent', label: 'cumprida' },
  frozen: { color: 'ice', label: 'congelada' },
  missed: { color: 'border', label: 'perdida' },
};

/**
 * Disciplina: one weekly streak. Main card (flame, weeks in a row, record and
 * freezes), this week day by day (water and class marks + progress), the last
 * weeks and the rule in one sentence, details in a sheet.
 */
export function StreaksScreen() {
  const { size } = useAppTheme();
  const { userId } = useSession();
  const discipline = useDiscipline(userId);
  const [info, setInfo] = useState(false);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen nativeHeader title="Disciplina" onBack={back}>
      {discipline.data ? (
        <Box gap="s24">
          <StreakCard discipline={discipline.data} />
          <ThisWeek discipline={discipline.data} />
          <Timeline discipline={discipline.data} />
          <Box flexDirection="row" alignItems="center" gap="s8">
            <Text variant="body" color="textMuted" flex={1}>
              {`A semana conta com ${DISCIPLINE_RULE.classes} aula confirmada e a meta de água batida em ${DISCIPLINE_RULE.waterDays} dias.`}
            </Text>
            <Pressable
              onPress={() => setInfo(true)}
              accessibilityRole="button"
              accessibilityLabel="Como funciona a disciplina"
              style={{ width: size.touchTarget, height: size.touchTarget, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="info" color="textMuted" />
            </Pressable>
          </Box>
        </Box>
      ) : discipline.isError ? (
        <LoadError title="Não foi possível carregar a disciplina" onRetry={() => void discipline.refetch()} />
      ) : (
        <Spinner accessibilityLabel="Carregando" />
      )}
      <BottomSheet visible={info} onRequestClose={() => setInfo(false)} dismissLabel="Fechar">
        <RuleDetails />
      </BottomSheet>
    </Screen>
  );
}

/** Flame + weeks in a row (big), record and freezes on the bottom line. */
function StreakCard({ discipline }: { discipline: Discipline }) {
  const theme = useAppTheme();
  const { current, record, freezes, weekDone } = discipline;
  const unit = current === 1 ? 'semana seguida' : 'semanas seguidas';
  return (
    <Card gap="s16">
      <Box flexDirection="row" alignItems="center" gap="s12" accessible accessibilityLabel={`${current} ${unit}`}>
        {/* TODO(motion): flame lighting up when the week is done. */}
        <Icon name="flame" color={current > 0 ? 'accent' : 'disabled'} active={weekDone} size={theme.size.iconEmpty} />
        <Text variant="displayXl">{current}</Text>
        <Text variant="captionCaps" flex={1}>
          {unit}
        </Text>
      </Box>
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap="s12">
        <Text variant="caption">{`Recorde: ${weeksLabel(record)}`}</Text>
        <Box
          flexDirection="row"
          alignItems="center"
          gap="s4"
          accessible
          accessibilityLabel={`${freezes} de ${DISCIPLINE_RULE.maxFreezes} congelamentos disponíveis`}
        >
          {Array.from({ length: DISCIPLINE_RULE.maxFreezes }, (_, i) => (
            <Icon key={i} name="freeze" color={i < freezes ? 'ice' : 'disabled'} active={i < freezes} />
          ))}
        </Box>
      </Box>
    </Card>
  );
}

/** Monday–Sunday: water drop (filled when met) and class mark (filled confirmed, outline pending). */
function ThisWeek({ discipline }: { discipline: Discipline }) {
  const theme = useAppTheme();
  const byDay = new Map(discipline.days.map((d) => [d.day, d]));
  const days = Array.from({ length: 7 }, (_, i) => addDays(discipline.weekStart, i));
  const mark = theme.size.iconInline;
  return (
    <Box gap="s12">
      <Text variant="captionCaps">Esta semana</Text>
      <Card gap="s16">
        <Box flexDirection="row" justifyContent="space-between">
          {days.map((d, i) => {
            const day: DisciplineDay = byDay.get(d) ?? { day: d, water: 'unconfigured', confirmed: 0, pending: 0 };
            const drank = day.water === 'done';
            const trained = day.confirmed > 0;
            const pending = !trained && day.pending > 0;
            const isToday = d === discipline.today;
            const future = d > discipline.today;
            return (
              <Box
                key={d}
                alignItems="center"
                gap="s8"
                accessible
                accessibilityLabel={`${WEEK_NAMES[i]}: ${drank ? 'meta de água batida' : 'meta de água não batida'}, ${trained ? 'aula confirmada' : pending ? 'aula aguardando confirmação' : 'sem aula'}`}
              >
                <Text variant="caption" color={isToday ? 'accent' : 'textMuted'}>
                  {WEEK_LETTERS[i]}
                </Text>
                <Icon name="drop" color={drank ? 'water' : future ? 'border' : 'disabled'} active={drank} size={mark} />
                {trained || pending ? (
                  <Icon name="barbell" color="accent" active={trained} size={mark} />
                ) : (
                  <Box width={mark} height={mark} />
                )}
              </Box>
            );
          })}
        </Box>
        <Text variant="bodyStrong" color={discipline.weekDone ? 'success' : 'text'}>
          {weekProgressText(discipline)}
        </Text>
      </Card>
    </Box>
  );
}

/** Last closed weeks in small squares: done (accent), frozen (ice), missed (off). */
function Timeline({ discipline }: { discipline: Discipline }) {
  const theme = useAppTheme();
  const weeks = discipline.weeks.slice(-TIMELINE);
  if (!weeks.length) return null;
  const square = theme.spacing.s24;
  return (
    <Box gap="s12">
      <Text variant="captionCaps">Últimas semanas</Text>
      <Box flexDirection="row" gap="s8">
        {weeks.map((w) => {
          const look = WEEK_LOOK[w.state];
          return (
            <Box
              key={w.weekStart}
              width={square}
              height={square}
              backgroundColor={look.color}
              style={{ borderRadius: theme.spacing.s4 }}
              accessible
              accessibilityLabel={`Semana de ${w.weekStart.slice(8)}/${w.weekStart.slice(5, 7)}: ${look.label}`}
            />
          );
        })}
      </Box>
    </Box>
  );
}

/** The rule in detail (info sheet). */
function RuleDetails() {
  return (
    <SheetForm title="Como funciona a disciplina">
      <Rule title="Semana cumprida">
        {`De segunda a domingo: pelo menos ${DISCIPLINE_RULE.classes} aula confirmada pelo professor, em qualquer modalidade, e a meta de água batida em ${DISCIPLINE_RULE.waterDays} dos 7 dias. Em dia de limite de água, o dia conta entre 90% e 100% do limite.`}
      </Rule>
      <Rule title="Semana em andamento">
        A semana atual só conta como perdida quando termina. Uma aula aguardando confirmação ainda pode garantir a semana.
      </Rule>
      <Rule title="Congelamentos">
        {`A cada ${DISCIPLINE_RULE.earnEvery} semanas cumpridas seguidas você ganha um congelamento (no máximo ${DISCIPLINE_RULE.maxFreezes}). Se perder uma semana, ele é usado sozinho e a disciplina continua.`}
      </Rule>
    </SheetForm>
  );
}

function Rule({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box gap="s4">
      <Text variant="bodyStrong">{title}</Text>
      <Text variant="body" color="textMuted">
        {children}
      </Text>
    </Box>
  );
}
