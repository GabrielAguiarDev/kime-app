import { Alert, Linking, Switch } from 'react-native';

import { Box, Card, Icon, Text } from '@components';
import { notificationsAvailable } from '@infra/notifications';
import { useClassReminderSetting } from '@services/reminders';
import { useAppTheme } from '@theme';

/** Perfil (students): "Lembrete das aulas", 1 h before each class of the modalities they train. */
export function ClassReminderSwitch() {
  const { colors } = useAppTheme();
  const { enabled, setEnabled } = useClassReminderSetting();

  const toggle = async (on: boolean) => {
    const result = await setEnabled(on);
    if (result === 'denied') {
      Alert.alert('Notificações desligadas', 'Para receber lembretes, permita as notificações do Kimi nos Ajustes do celular.', [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Abrir Ajustes', onPress: () => void Linking.openSettings() },
      ]);
    }
  };

  return (
    <Card flexDirection="row" alignItems="center" gap="s12">
      <Icon name="clock" color="textMuted" />
      <Box flex={1} gap="s4">
        <Text variant="bodyStrong">Lembrete das aulas</Text>
        <Text variant="caption">
          {notificationsAvailable
            ? '1 hora antes de cada aula das modalidades que você treina.'
            : 'Disponível depois de atualizar o app.'}
        </Text>
      </Box>
      <Switch
        value={enabled && notificationsAvailable}
        disabled={!notificationsAvailable}
        onValueChange={(on) => void toggle(on)}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor={colors.text}
        ios_backgroundColor={colors.border}
        accessibilityLabel="Lembrete das aulas"
      />
    </Card>
  );
}
