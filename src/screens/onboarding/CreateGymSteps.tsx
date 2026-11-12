import * as ImagePicker from 'expo-image-picker';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable } from 'react-native';

import { AcademyLogo, Box, Button, Card, ChoiceRow, Icon, PhotoCropper, Text, TextField } from '@components';
import {
  ACADEMY_NAME_MAX,
  annualDiscountLabel,
  formatBrl,
  MODALITY_NAME_MAX,
  monthlyPriceFor,
  normalizeModalityName,
  PLANS,
  SIGNUP_MODALITIES,
  studentLimitLabel,
  TRIAL_DAYS,
  usesBeltsByDefault,
  type BillingPeriod,
  type PlanTier,
  type SignupModality,
} from '@domain/Gym';
import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';
import { squarePickerOptions } from '@utils/squareImage';

// ---------------------------------------------------------------- plans ---
export function PlanStep({
  tier,
  onTier,
  period,
  onPeriod,
}: {
  tier: PlanTier;
  onTier: (t: PlanTier) => void;
  period: BillingPeriod;
  onPeriod: (p: BillingPeriod) => void;
}) {
  const iconInline = useAppTheme().size.iconInline;
  return (
    <Box gap="s16">
      <Text variant="body" color="textMuted">
        {TRIAL_DAYS} dias grátis em qualquer plano. Você pode trocar depois.
      </Text>
      <ChoiceRow
        accessibilityLabel="Período de cobrança"
        options={[
          { value: 'monthly', label: 'Mensal' },
          { value: 'annual', label: `Anual ${annualDiscountLabel()}` },
        ]}
        value={period}
        onChange={onPeriod}
      />
      {PLANS.map((plan) => {
        const selected = plan.tier === tier;
        const price = formatBrl(monthlyPriceFor(plan, period));
        return (
          <Card
            key={plan.tier}
            selected={selected}
            onPress={() => onTier(plan.tier)}
            accessibilityLabel={`${plan.name}${plan.popular ? ', mais escolhido' : ''}: ${price} por mês. ${studentLimitLabel(plan)}`}
            gap="s12"
          >
            <Box flexDirection="row" alignItems="center" gap="s8">
              <Text variant="heading" color={selected ? 'accent' : 'text'} flex={1}>
                {plan.name}
              </Text>
              {plan.popular ? (
                <Box backgroundColor="accent" borderRadius="sm" paddingHorizontal="s8" paddingVertical="s4">
                  <Text variant="captionCaps" color="onAccent">
                    Mais escolhido
                  </Text>
                </Box>
              ) : null}
            </Box>
            <Box flexDirection="row" alignItems="flex-end" gap="s4">
              {/* TODO(motion): price changing with the period toggle. */}
              <Text variant="displayLg">{price}</Text>
              <Text variant="body" color="textMuted" paddingBottom="s4">
                /mês
              </Text>
            </Box>
            <Text variant="caption">
              {period === 'annual' ? `Cobrado anualmente · ${studentLimitLabel(plan)}` : studentLimitLabel(plan)}
            </Text>
            <Box gap="s8">
              {plan.benefits.map((b) => (
                <Box key={b} flexDirection="row" alignItems="center" gap="s8">
                  <Icon name="done" color="success" size={iconInline} />
                  <Text variant="body">{b}</Text>
                </Box>
              ))}
            </Box>
          </Card>
        );
      })}
    </Box>
  );
}

// ----------------------------------------------------------------- name ---
export function NameStep({ name, onName, onSubmit }: { name: string; onName: (n: string) => void; onSubmit: () => void }) {
  return (
    <TextField
      label="Nome da academia"
      value={name}
      onChangeText={onName}
      maxLength={ACADEMY_NAME_MAX}
      autoCapitalize="words"
      placeholder="Ex.: Kimi Jiu-Jitsu"
      returnKeyType="next"
      onSubmitEditing={onSubmit}
      autoFocus
    />
  );
}

// ----------------------------------------------------------------- logo ---
/** Same crop as Configurações (square); the upload happens once the academy exists. */
export function LogoStep({ name, logoUri, onLogo }: { name: string; logoUri: string | null; onLogo: (uri: string) => void }) {
  // The picked image waiting on the crop screen.
  const [cropping, setCropping] = useState<string | null>(null);
  const pick = async (from: 'camera' | 'library') => {
    const options = squarePickerOptions(from);
    if (from === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Câmera', 'Permita o acesso à câmera nos Ajustes para fotografar a logo.');
        return;
      }
    }
    const result =
      from === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    setCropping(asset.uri);
  };

  const cropped = (uri: string) => {
    setCropping(null);
    haptics.success();
    onLogo(uri);
  };

  return (
    <Box alignItems="center" gap="s24">
      <AcademyLogo name={name} url={logoUri} size="hero" />
      <Text variant="body" color="textMuted" textAlign="center">
        Ela aparece no topo do app e para quem entra com o código da academia.
      </Text>
      <Box alignSelf="stretch" gap="s12">
        <Button title={logoUri ? 'Trocar pela galeria' : 'Escolher da galeria'} variant="secondary" icon="image" onPress={() => void pick('library')} />
        <Button title="Tirar foto" variant="secondary" icon="camera" onPress={() => void pick('camera')} />
      </Box>
      <PhotoCropper source={cropping} shape="square" onCancel={() => setCropping(null)} onDone={cropped} />
    </Box>
  );
}

// ----------------------------------------------------------- modalities ---
export const OTHER_KEY = '__other__';

/**
 * A selected modality. Whether it has graduation is not asked here: it gets an
 * internal default (usesBeltsByDefault) and the owner changes it later in
 * Perfil → Modalidades, where the graduations are added.
 */
export interface ModalityChoice {
  key: string;
  usesBelts: boolean;
}

/** The selection (in tap order) → what is sent; "Outra" takes the typed name. */
export function toSignupModalities(choices: ModalityChoice[], otherName: string): SignupModality[] {
  return choices.map((c) => ({ name: c.key === OTHER_KEY ? otherName.trim() : c.key, usesBelts: c.usesBelts }));
}

export function ModalitiesStep({
  choices,
  onChoices,
  otherName,
  onOtherName,
}: {
  choices: ModalityChoice[];
  onChoices: (c: ModalityChoice[]) => void;
  otherName: string;
  onOtherName: (n: string) => void;
}) {
  const toggle = (key: string) => {
    const has = choices.some((c) => c.key === key);
    onChoices(has ? choices.filter((c) => c.key !== key) : [...choices, { key, usesBelts: key !== OTHER_KEY && usesBeltsByDefault(key) }]);
  };
  // Only a clash with a SELECTED option blocks (same rule as isValidModalitySelection).
  const otherClash =
    otherName.trim() !== '' &&
    choices.some((c) => c.key !== OTHER_KEY && normalizeModalityName(c.key) === normalizeModalityName(otherName));

  return (
    <Box gap="cardGap">
      {[...SIGNUP_MODALITIES, OTHER_KEY].map((key) => {
        const choice = choices.find((c) => c.key === key);
        const label = key === OTHER_KEY ? 'Outra' : key;
        return (
          <ModalityCard
            key={key}
            label={label}
            selected={!!choice}
            onToggle={() => toggle(key)}
          >
            {choice && key === OTHER_KEY ? (
              <TextField
                label="Nome da modalidade"
                value={otherName}
                onChangeText={onOtherName}
                maxLength={MODALITY_NAME_MAX}
                autoCapitalize="words"
                placeholder="Ex.: Capoeira"
                errorMessage={otherClash ? 'Essa modalidade já está selecionada acima.' : undefined}
              />
            ) : null}
          </ModalityCard>
        );
      })}
      <Text variant="caption">As faixas das outras modalidades você configura depois em Modalidades e faixas.</Text>
    </Box>
  );
}

function ModalityCard({
  label,
  selected,
  onToggle,
  children,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  const { size, border } = useAppTheme();
  return (
    // Not a tappable Card: the "Outra" name field lives inside it.
    <Box
      borderRadius="lg"
      borderWidth={border.width}
      borderColor={selected ? 'accent' : 'border'}
      backgroundColor={selected ? 'accentSelected' : 'surface'}
    >
      <Pressable
        onPress={() => {
          haptics.tap();
          onToggle();
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={label}
      >
        {/* TODO(motion): card selection changing. */}
        <Box flexDirection="row" alignItems="center" gap="s12" padding="cardPadding" minHeight={size.touchTarget}>
          <Text variant="bodyStrong" color={selected ? 'accent' : 'text'} flex={1}>
            {label}
          </Text>
          <Icon name={selected ? 'check' : 'open'} color={selected ? 'accent' : 'textMuted'} active={selected} />
        </Box>
      </Pressable>
      {selected && children ? (
        <Box paddingHorizontal="cardPadding" paddingBottom="cardPadding">
          {children}
        </Box>
      ) : null}
    </Box>
  );
}
