import { router } from 'expo-router';
import { Platform } from 'react-native';

import { Box, Card, Mascot, Screen, Text } from '@components';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

const STEPS =
  Platform.OS === 'ios'
    ? [
        'Na tela de início, toque e segure num espaço vazio até os ícones tremerem.',
        'Toque em Editar, no canto superior, e depois em Adicionar Widget.',
        'Procure por Kimi e escolha o widget de água.',
        'Toque em Adicionar Widget e em OK.',
      ]
    : [
        'Na tela inicial, toque e segure num espaço vazio.',
        'Toque em Widgets.',
        'Procure por Kimi e segure o widget de água.',
        'Arraste até onde quiser e solte.',
      ];

/** How to add the water widget (the system adds it; the app cannot). */
export function WaterWidgetScreen() {
  return (
    <Screen nativeHeader title="Widget de água" onBack={back}>
      <Box gap="s24">
        <Box alignItems="center" gap="s12">
          <Mascot size="hero" />
          <Text variant="body" color="textMuted" textAlign="center">
            Registre uma garrafa direto da tela de início, sem abrir o app.
          </Text>
        </Box>
        <Card gap="s16">
          {STEPS.map((step, index) => (
            <Box key={step} flexDirection="row" gap="s12">
              <Text variant="bodyStrong" color="accent">
                {index + 1}
              </Text>
              <Text variant="body" flex={1}>
                {step}
              </Text>
            </Box>
          ))}
        </Card>
      </Box>
    </Screen>
  );
}
