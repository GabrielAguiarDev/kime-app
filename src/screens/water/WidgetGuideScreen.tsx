import { router } from 'expo-router';
import { Platform } from 'react-native';

import { Box, Button, Card, Icon, Screen, Text, WaterRing } from '@components';
import { useWaterDay } from '@domain/Water';
import { useWaterSettings } from '@services/water';
import { useAppTheme } from '@theme';

import { formatMl } from './format';

const STEPS = Platform.select({
  ios: [
    'Toque e segure um espaço vazio da Tela de Início até os ícones tremerem.',
    'Toque em "Editar", no canto superior, e depois em "Adicionar Widget".',
    'Busque por "Kimi" e escolha o tamanho pequeno ou médio.',
    'Toque em "Adicionar Widget" e depois em "OK".',
  ],
  default: [
    'Toque e segure um espaço vazio da tela inicial.',
    'Toque em "Widgets".',
    'Procure por "Kimi" e arraste o widget de água para a tela.',
  ],
});

/**
 * iOS cannot add a widget from inside the app: steps + a preview of what the
 * widget shows (section 9). Also the fallback for Android launchers without pinning.
 */
export function WidgetGuideScreen() {
  const back = () => (router.canGoBack() ? router.back() : router.replace('/agua'));
  return (
    <Screen title="Widget de água" onBack={back} footer={<Button title="Entendi" onPress={back} />}>
      <Box gap="s24">
        <Text variant="body" color="textMuted">
          Registre sua garrafa direto da Tela de Início, sem abrir o app. O registro fica no aparelho e vai para o
          Kimi na próxima vez que você abrir o app.
        </Text>
        <WidgetPreview />
        <Box gap="s12">
          {STEPS.map((step, index) => (
            <Box key={step} flexDirection="row" gap="s12">
              <Text variant="counter" color="water">
                {index + 1}
              </Text>
              <Text variant="body" flex={1}>
                {step}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
    </Screen>
  );
}

/** What the small widget shows today (static picture, not interactive). */
function WidgetPreview() {
  const { size } = useAppTheme();
  const { userId, settings } = useWaterSettings();
  const { data: day } = useWaterDay(userId, settings?.timeZone);
  const bottle = settings?.bottleMl ?? 500;
  const goal = settings?.goalMl ?? null;
  const total = day?.totalMl ?? 0;

  return (
    <Box alignItems="center" accessible accessibilityLabel="Prévia do widget de água">
      {/* Same layout as the small widget: ring and total on top, button at the bottom. */}
      <Card gap="s12" width={size.waterRing}>
        <Box flexDirection="row" alignItems="center" gap="s8">
          <WaterRing consumedMl={total} goalMl={goal} size={size.widgetRing} hideLabel />
          <Box flex={1}>
            <Text variant="displayLg" numberOfLines={1} adjustsFontSizeToFit>
              {formatMl(total)}
            </Text>
            <Text variant="caption" numberOfLines={1}>
              {goal ? `de ${formatMl(goal)} ml` : 'ml hoje'}
            </Text>
          </Box>
        </Box>
        <Box flexDirection="row" alignItems="center" justifyContent="center" gap="s8" backgroundColor="water" borderRadius="md" padding="s12">
          <Icon name="drop" color="onWater" size={size.iconInline} />
          <Text variant="button" color="onWater">
            +{formatMl(bottle)} ml
          </Text>
        </Box>
      </Card>
    </Box>
  );
}
