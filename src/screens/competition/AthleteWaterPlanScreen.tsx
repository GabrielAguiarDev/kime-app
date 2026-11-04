import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Box, Button, EmptyState, Screen, Text, TextField } from '@components';
import { WEEK_ORDER, WEEKDAY_LABELS, useAcademyToday, type Weekday } from '@domain/Classes';
import {
  emptyWeekTargets,
  isValidPlanTarget,
  planInForce,
  useSetWaterPlan,
  useWaterPlans,
  WATER_PLAN_MAX_ML,
  WATER_PLAN_MIN_ML,
  type WaterPlan,
  type WeekTargets,
} from '@domain/Competition';
import { errorMessage } from '@infra';
import { formatMl } from '@screens/water/format';
import { haptics } from '@utils/haptics';

import { useAthlete } from './useAthlete';

/**
 * Staff: weekly water plan of a competitor. One field per weekday (ml); empty =
 * the athlete's automatic goal that day. Saving writes the plan of the current
 * week, which holds in the next weeks until it is changed again.
 */
export function AthleteWaterPlanScreen() {
  const { academyId, member, isLoading, notCompetitor, back } = useAthlete();
  const plans = useWaterPlans(member?.userId);
  const today = useAcademyToday(academyId);

  if (isLoading || plans.isLoading || today.isLoading) {
    return (
      <Screen nativeHeader title="Plano de água" onBack={back}>
        <ActivityIndicator accessibilityLabel="Carregando" />
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
  const [values, setValues] = useState(initial);
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
  const changed = WEEK_ORDER.some((d) => values[d] !== initial[d]);

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
            save.mutate(parsed, {
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
        {WEEK_ORDER.map((d) => (
          <TextField
            key={d}
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
