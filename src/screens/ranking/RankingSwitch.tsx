import { Alert, Switch } from 'react-native';

import { Box, Card, Icon, Text } from '@components';
import { useMyProfile, useSetShowInRanking } from '@domain/Profile';
import { errorMessage } from '@infra';
import { useSession } from '@services/session';
import { useAppTheme } from '@theme';

/** Perfil (students): "Aparecer no ranking" — off hides the student from the ranking and the champions. */
export function RankingSwitch() {
  const { colors } = useAppTheme();
  const { userId } = useSession();
  const profile = useMyProfile(userId);
  const set = useSetShowInRanking(userId);
  const value = set.isPending ? (set.variables ?? true) : (profile.data?.showInRanking ?? true);

  return (
    <Card flexDirection="row" alignItems="center" gap="s12">
      <Icon name="trophy" color="textMuted" />
      <Box flex={1} gap="s4">
        <Text variant="bodyStrong">Aparecer no ranking</Text>
        <Text variant="caption">Seu nome, foto e aulas confirmadas no ranking da academia.</Text>
      </Box>
      <Switch
        value={value}
        disabled={!profile.data || set.isPending}
        onValueChange={(on) => set.mutate(on, { onError: (e) => Alert.alert('Ranking', errorMessage(e)) })}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor={colors.text}
        ios_backgroundColor={colors.border}
        accessibilityLabel="Aparecer no ranking"
      />
    </Card>
  );
}
