import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Box, Button, Screen, SelectionGrid, Text, TextField } from '@components';
import { useMyProfile, useUpdateBodyAndBottle, type Profile } from '@domain/Profile';
import {
  autoDailyGoalMl,
  BOTTLE_MAX_ML,
  BOTTLE_MIN_ML,
  BOTTLE_PRESETS,
  isValidBottle,
  ML_PER_KG,
  parseDecimal,
  WEIGHT_RANGE_KG,
} from '@domain/Water';
import { errorMessage } from '@infra';
import { useSession } from '@services/session';
import { haptics } from '@utils/haptics';

import { formatMl } from './format';

const OTHER = 'Outro';
const presetLabel = (ml: number) => `${formatMl(ml)} ml`;
const PRESET_LABELS = BOTTLE_PRESETS.map(presetLabel);

/**
 * Sua garrafa (also the widget's "Configure sua garrafa"): bottle size and
 * weight — the same weight as Meus dados (one profile field). The daily goal is
 * calculated from it. Height is only in Meus dados.
 */
export function WaterSettingsScreen() {
  const { userId } = useSession();
  const profile = useMyProfile(userId);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/agua'));

  if (!profile.data) {
    return (
      <Screen nativeHeader title="Sua garrafa" onBack={back}>
        {profile.isError ? (
          <Text variant="body" color="danger">
            {errorMessage(profile.error)}
          </Text>
        ) : (
          <ActivityIndicator accessibilityLabel="Carregando" />
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
  const [weight, setWeight] = useState(profile.weightKg ? String(profile.weightKg).replace('.', ',') : '');
  const start = initialBottle(profile.bottleMl);
  const [choice, setChoice] = useState<string | null>(start.choice);
  const [other, setOther] = useState(start.other);

  const weightKg = weight.trim() ? parseDecimal(weight) : null;
  const weightError =
    weight.trim() && (weightKg === null || weightKg < WEIGHT_RANGE_KG.min || weightKg > WEIGHT_RANGE_KG.max)
      ? `Informe um peso entre ${WEIGHT_RANGE_KG.min} e ${WEIGHT_RANGE_KG.max} kg.`
      : undefined;

  const otherMl = other.trim() ? Number(other.trim()) : NaN;
  const bottleMl =
    choice === OTHER ? (isValidBottle(otherMl) ? otherMl : null) : (BOTTLE_PRESETS[PRESET_LABELS.indexOf(choice ?? '')] ?? null);
  const otherError =
    choice === OTHER && other.trim() && !isValidBottle(otherMl)
      ? `Use um valor entre ${formatMl(BOTTLE_MIN_ML)} e ${formatMl(BOTTLE_MAX_ML)} ml.`
      : undefined;

  const goal = weightError ? null : autoDailyGoalMl(weightKg);
  const valid = !weightError && bottleMl !== null;

  const submit = () =>
    save.mutate(
      { weightKg: weightError ? null : weightKg, bottleMl },
      {
        onSuccess: () => {
          haptics.success();
          onDone();
        },
      },
    );

  return (
    <Screen nativeHeader
      title="Sua garrafa"
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
          <Text variant="captionCaps">Seu peso</Text>
          <TextField
            label="Peso"
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            unit="kg"
            errorMessage={weightError}
          />
          <Text variant="body" color="textMuted">
            {goal
              ? `Sua meta diária: ${formatMl(goal)} ml (${ML_PER_KG} ml por kg).`
              : `Com o peso, o Kimi calcula sua meta diária (${ML_PER_KG} ml por kg).`}{' '}
            É o mesmo peso de Meus dados.
          </Text>
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
