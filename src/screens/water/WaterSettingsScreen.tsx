import { router } from 'expo-router';
import { useState } from 'react';

import { Box, Button, Card, Screen, SelectionGrid, Text, TextButton, TextField, Spinner } from '@components';
import { formatBodyNumber, useMyProfile, useUpdateBodyAndBottle, type Profile } from '@domain/Profile';
import {
  autoDailyGoalMl,
  BOTTLE_MAX_ML,
  BOTTLE_MIN_ML,
  BOTTLE_PRESETS,
  isValidBottle,
  ML_PER_KG,
} from '@domain/Water';
import { errorMessage } from '@infra';
import { usePlannedWater } from '@services/water/usePlannedWater';
import { useSession } from '@services/session';
import { haptics } from '@utils/haptics';

import { formatMl } from './format';

const OTHER = 'Outro';
const presetLabel = (ml: number) => `${formatMl(ml)} ml`;
const PRESET_LABELS = BOTTLE_PRESETS.map(presetLabel);

const TITLE = 'Garrafa e meta de água';

/**
 * Garrafa e meta de água (also the widget's "Configure sua garrafa"): bottle
 * size and the daily goal — from the weight of Meus dados (shortcut to change
 * it there) or a personal goal. The professor’s active plan locks the goal.
 */
export function WaterSettingsScreen() {
  const { userId } = useSession();
  const profile = useMyProfile(userId);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/agua'));

  if (!profile.data) {
    return (
      <Screen nativeHeader title={TITLE} onBack={back}>
        {profile.isError ? (
          <Text variant="body" color="danger">
            {errorMessage(profile.error)}
          </Text>
        ) : (
          <Spinner accessibilityLabel="Carregando" />
        )}
      </Screen>
    );
  }
  // Form state starts from the loaded profile.
  return <SettingsForm profile={profile.data} userId={userId} onDone={back} />;
}

function initialBottle(bottleMl: number | null): { choice: string | null; other: string } {
  if (bottleMl === null) return { choice: null, other: '' };
  const preset = (BOTTLE_PRESETS as readonly number[]).includes(bottleMl);
  return preset ? { choice: presetLabel(bottleMl), other: '' } : { choice: OTHER, other: String(bottleMl) };
}

function SettingsForm({ profile, userId, onDone }: { profile: Profile; userId?: string; onDone: () => void }) {
  const save = useUpdateBodyAndBottle(userId);
  const planned = usePlannedWater(profile.timeZone);
  const [goalMode, setGoalMode] = useState(profile.personalWaterGoalMl ? 'Personalizada' : 'Pelo meu peso');
  const [personalGoal, setPersonalGoal] = useState(profile.personalWaterGoalMl ? String(profile.personalWaterGoalMl) : '');
  const personalMl = Number(personalGoal);
  const personalError = goalMode === 'Personalizada' && (!Number.isInteger(personalMl) || personalMl < 50 || personalMl > 20000)
    ? 'Informe uma meta entre 50 e 20.000 ml.' : undefined;
  const start = initialBottle(profile.bottleMl);
  const [choice, setChoice] = useState<string | null>(start.choice);
  const [other, setOther] = useState(start.other);

  const otherMl = other.trim() ? Number(other.trim()) : NaN;
  const bottleMl =
    choice === OTHER ? (isValidBottle(otherMl) ? otherMl : null) : (BOTTLE_PRESETS[PRESET_LABELS.indexOf(choice ?? '')] ?? null);
  const otherError =
    choice === OTHER && other.trim() && !isValidBottle(otherMl)
      ? `Use um valor entre ${formatMl(BOTTLE_MIN_ML)} e ${formatMl(BOTTLE_MAX_ML)} ml.`
      : undefined;

  const goal = autoDailyGoalMl(profile.weightKg);
  const valid = bottleMl !== null && !planned.isLoading && !planned.isError && (planned.isLocked || !personalError);

  const submit = () =>
    save.mutate(
      { bottleMl, ...(planned.isLocked ? {} : { personalWaterGoalMl: goalMode === 'Personalizada' ? personalMl : null }) },
      {
        onSuccess: () => {
          haptics.success();
          onDone();
        },
      },
    );

  return (
    <Screen nativeHeader
      title={TITLE}
      onBack={onDone}
      footer={<Button title="Salvar" disabled={!valid} loading={save.isPending} onPress={submit} />}
    >
      <Box gap="s24">
        <Box gap="s12">
          <Text variant="captionCaps">Tamanho da garrafa</Text>
          {/* Selection cards (11.5). */}
          <SelectionGrid
            options={[...PRESET_LABELS, OTHER]}
            selected={choice ? [choice] : []}
            onToggle={(option) => setChoice(option)}
            columns={2}
          />
          {choice === OTHER ? (
            <TextField
              label="Garrafa"
              value={other}
              onChangeText={(text) => setOther(text.replace(/\D/g, ''))}
              keyboardType="number-pad"
              unit="ml"
              errorMessage={otherError}
            />
          ) : null}
          <Text variant="caption">Cada toque no botão de água, no app ou no widget, registra uma garrafa.</Text>
        </Box>


        <Box gap="s12">
          <Text variant="captionCaps">Meta diária</Text>
          {planned.isLoading ? <Spinner accessibilityLabel="Carregando meta" /> : planned.isError ? (
            <Text variant="caption" color="danger">Não foi possível verificar o plano do professor. Tente novamente.</Text>
          ) : planned.isLocked ? (
            <Text variant="body" color="textMuted">
              {planned.plannedToday ? `Meta de hoje: ${formatMl(planned.plannedToday)} ml. ` : ''}
              Seu professor definiu um plano de água. A edição da sua meta fica bloqueada até o plano ser finalizado pelo professor.
            </Text>
          ) : (
            <>
              <SelectionGrid options={['Pelo meu peso', 'Personalizada']} selected={[goalMode]} onToggle={setGoalMode} />
              {goalMode === 'Pelo meu peso' ? (
                <Card gap="s8">
                  {goal && profile.weightKg ? (
                    <>
                      <Text variant="caption">Meta do dia</Text>
                      <Text variant="heading">{`${formatMl(goal)} ml`}</Text>
                      <Text variant="caption">
                        {`${formatBodyNumber(profile.weightKg)} kg × ${ML_PER_KG} ml por kg`}
                      </Text>
                    </>
                  ) : (
                    <Text variant="body" color="textMuted">
                      {`Informe seu peso em Meus dados e o Kimi calcula sua meta diária (${ML_PER_KG} ml por kg).`}
                    </Text>
                  )}
                  <Box alignItems="flex-start">
                    <TextButton
                      title={profile.weightKg ? 'Alterar peso em Meus dados' : 'Informar peso em Meus dados'}
                      onPress={() => router.push('/conta/dados')}
                    />
                  </Box>
                </Card>
              ) : null}
              {goalMode === 'Personalizada' ? (
                <TextField label="Sua meta diária" value={personalGoal} onChangeText={(text) => setPersonalGoal(text.replace(/\D/g, ''))} keyboardType="number-pad" unit="ml" errorMessage={personalError} />
              ) : null}
            </>
          )}
        </Box>

        {save.error ? (
          <Text variant="caption" color="danger">
            {errorMessage(save.error)}
          </Text>
        ) : null}
      </Box>
    </Screen>
  );
}
