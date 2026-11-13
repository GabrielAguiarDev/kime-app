import { useState } from 'react';

import { Box, Button, EmptyState, FilterChips, Screen, Text, TextField, Spinner } from '@components';
import { WEEK_ORDER, WEEKDAY_LABELS, useAcademyToday, type Weekday } from '@domain/Classes';
import {
  emptyWeekLimits,
  emptyWeekTargets,
  isValidPlanTarget,
  planInForce,
  useSetWaterPlan,
  useWaterPlans,
  WATER_PLAN_MAX_ML,
  WATER_PLAN_MIN_ML,
  type WaterPlan,
  type WeekLimits,
  type WeekTargets,
} from '@domain/Competition';
import { errorMessage } from '@infra';
import { formatMl } from '@screens/water/format';
import { haptics } from '@utils/haptics';

import { useAthlete } from './useAthlete';

/**
 * Staff: weekly water plan of a competitor. One field per weekday (ml); empty =
 * the athlete's automatic goal that day. Each day is a goal ("Meta": done when
 * the total reaches it) or a limit ("Limite": done between 90 % and 100 %). Saving writes the plan of the current
 * week, which holds in the next weeks until it is changed again.
 */
export function AthleteWaterPlanScreen() {
  const { academyId, member, isLoading, notCompetitor, back } = useAthlete();
  const plans = useWaterPlans(member?.userId);
  const today = useAcademyToday(academyId);

  if (isLoading || plans.isLoading || today.isLoading) {
    return (
      <Screen nativeHeader title="Plano de água" onBack={back}>
        <Spinner accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if (notCompetitor || !member || !academyId) {
    return (
      <Screen nativeHeader title="Plano de água" onBack={back}>
        <EmptyState title="Este aluno não está na equipe." description="Só atletas da equipe de competição têm plano." />
      </Screen>
    );
  }
  if (plans.isError || !today.data) {
    return (
      <Screen nativeHeader title="Plano de água" onBack={back}>
        <EmptyState
          visual="icon"
          icon="offline"
          title="Não foi possível carregar o plano"
          action={<Button title="Tentar de novo" variant="secondary" onPress={() => void plans.refetch()} />}
        />
      </Screen>
    );
  }

  // Plans of this academy only: another academy's plan is not edited here.
  const current = planInForce(
    (plans.data ?? []).filter((p) => p.academyId === academyId),
    today.data,
  );
  return (
    <PlanForm
      key={current?.id ?? 'none'}
      academyId={academyId}
      athleteId={member.userId}
      athleteName={member.fullName}
      current={current}
      onBack={back}
    />
  );
}

function toText(targets: WeekTargets): Record<Weekday, string> {
  const out = {} as Record<Weekday, string>;
  for (const d of WEEK_ORDER) out[d] = targets[d] ? String(targets[d]) : '';
  return out;
}

function PlanForm({
  academyId,
  athleteId,
  athleteName,
  current,
  onBack,
}: {
  academyId: string;
  athleteId: string;
  athleteName: string;
  current: WaterPlan | null;
  onBack: () => void;
}) {
  const save = useSetWaterPlan(academyId, athleteId);
  const initial = toText(current?.targets ?? emptyWeekTargets());
  const initialLimits = current?.limits ?? emptyWeekLimits();
  const [values, setValues] = useState(initial);
  const [limits, setLimits] = useState<WeekLimits>(initialLimits);
  const [saved, setSaved] = useState(false);

  const parsed = emptyWeekTargets();
  const errors: Partial<Record<Weekday, string>> = {};
  for (const d of WEEK_ORDER) {
    const text = values[d].replace(/\D/g, '');
    if (!text) continue;
    const ml = Number(text);
    if (isValidPlanTarget(ml)) parsed[d] = ml;
    else errors[d] = `Entre ${formatMl(WATER_PLAN_MIN_ML)} e ${formatMl(WATER_PLAN_MAX_ML)} ml.`;
  }
  const valid = Object.keys(errors).length === 0;
  // A day without a value has no limit (the automatic goal is always a goal).
  const savedLimits = emptyWeekLimits();
  for (const d of WEEK_ORDER) savedLimits[d] = parsed[d] !== null && limits[d];
  const changed = WEEK_ORDER.some((d) => values[d] !== initial[d] || savedLimits[d] !== initialLimits[d]);

  return (
    <Screen
      nativeHeader
      title="Plano de água"
      onBack={onBack}
      footer={
        <Button
          title={saved && !changed ? 'Plano salvo' : 'Salvar plano'}
          disabled={!valid || !changed}
          loading={save.isPending}
          onPress={() =>
            save.mutate({ targets: parsed, limits: savedLimits }, {
              onSuccess: () => {
                haptics.success();
                setSaved(true);
              },
            })
          }
        />
      }
    >
      <Box gap="s16">
        <Text variant="body" color="textMuted">
          Meta diária de {athleteName}. Dia em branco usa a meta automática (35 ml por kg). O plano vale a partir desta
          semana e continua nas próximas até você mudar.
        </Text>
        <Text variant="caption">
          Meta: cumprida quando o total do dia chega ao valor. Limite: cumprido quando o total fica entre 90% e 100% do
          valor; passar do limite conta como não cumprido.
        </Text>
        {WEEK_ORDER.map((d) => (
          <Box key={d} gap="s8">
            <TextField
              label={WEEKDAY_LABELS[d].long}
              value={values[d]}
              onChangeText={(t) => {
                setSaved(false);
                setValues((v) => ({ ...v, [d]: t.replace(/\D/g, '').slice(0, 5) }));
              }}
              placeholder="Automática"
              keyboardType="number-pad"
              unit="ml"
              errorMessage={errors[d]}
            />
            {values[d] ? (
              <FilterChips
                accessibilityLabel={`Tipo do dia: ${WEEKDAY_LABELS[d].long}`}
                chips={[
                  { key: 'goal', label: 'Meta', selected: !limits[d] },
                  { key: 'limit', label: 'Limite', selected: limits[d] },
                ].map((c) => ({
                  ...c,
                  accessibilityLabel: `${WEEKDAY_LABELS[d].long}: ${c.label}`,
                  onPress: () => {
                    setSaved(false);
                    setLimits((l) => ({ ...l, [d]: c.key === 'limit' }));
                  },
                }))}
              />
            ) : null}
          </Box>
        ))}
        {save.error ? (
          <Text variant="caption" color="danger">
            {errorMessage(save.error)}
          </Text>
        ) : null}
      </Box>
    </Screen>
  );
}
