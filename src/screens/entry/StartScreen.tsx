import { router } from 'expo-router';

import { Box, Mascot, Screen, SelectionCard, Text } from '@components';
import { entryPath, type EntryPath } from '@services/entry';

/**
 * First screen, signed out. "Sou aluno" / "Sou professor" only picks the way
 * in and is remembered on this device; it is not a kind of account.
 */
/**
 * Back from the first step of a path (login, sign-up, code): the previous
 * screen when there is one, otherwise the first screen. A cold start lands
 * straight on the remembered path, with nothing underneath.
 */
export function backToStart() {
  if (router.canGoBack()) router.back();
  else router.replace('/start');
}

export function StartScreen() {
  const choose = (path: EntryPath) => {
    entryPath.set(path);
    // TODO(motion): transition from the choice into the chosen path.
    if (path === 'student') router.push('/codigo');
    else router.push('/sign-in');
  };

  return (
    <Screen scrollable={false}>
      <Box flex={1} justifyContent="center" gap="s24">
        <Box alignItems="center" gap="s12">
          <Mascot size="hero" />
          <Text variant="displayXl">KIMI</Text>
          <Text variant="body" color="textMuted" textAlign="center">
            Aulas, check-ins e graduação da sua academia.
          </Text>
        </Box>
        <Box gap="s12">
          <SelectionCard
            label="Sou aluno"
            description="Tenho o código da minha academia"
            selected={false}
            onPress={() => choose('student')}
          />
          <SelectionCard
            label="Sou professor"
            description="Dou aulas ou quero cadastrar minha academia"
            selected={false}
            onPress={() => choose('professor')}
          />
        </Box>
      </Box>
    </Screen>
  );
}
