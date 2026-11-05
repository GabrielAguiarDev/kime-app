import { Alert, Switch } from 'react-native';
import { Box, Icon, Text } from '@components';
import { useMyProfile, useSetShowCheckinsToPeers } from '@domain/Profile';
import { errorMessage } from '@infra';
import { useSession } from '@services/session';
import { useAppTheme } from '@theme';

export function CheckinPrivacySwitch() {
  const { colors } = useAppTheme();
  const { userId } = useSession();
  const profile = useMyProfile(userId);
  const set = useSetShowCheckinsToPeers(userId);
  return <Box flexDirection="row" alignItems="center" gap="s12" minHeight={60}>
    <Icon name="users" color="textMuted" />
    <Text variant="bodyStrong" flex={1}>Mostrar meu check-in para colegas</Text>
    <Switch value={set.isPending ? (set.variables ?? true) : (profile.data?.showCheckinsToPeers ?? true)}
      disabled={!profile.data || set.isPending} onValueChange={(show) => set.mutate(show, { onError: (e) => Alert.alert('Privacidade', errorMessage(e)) })}
      trackColor={{ true: colors.accent, false: colors.border }} thumbColor={colors.text} ios_backgroundColor={colors.border}
      accessibilityLabel="Mostrar meu check-in para colegas" />
  </Box>;
}
