import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { AcademyLogo, Box, Button, Card, FeedbackSheet, Screen, Text, TextField } from '@components';
import { useCodePreview, useJoinGym } from '@domain/Gym';
import { errorMessage } from '@infra';
import { haptics } from '@utils/haptics';

const CODE_LENGTH = 8;

/**
 * Student enters the academy's short invite code, sees which academy it is
 * (logo + name) and asks to join. Lands as a pending request.
 */
export function JoinGymScreen() {
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const join = useJoinGym();
  const normalized = code.replace(/\s/g, '').toUpperCase();
  const complete = normalized.length === CODE_LENGTH;
  const preview = useCodePreview(complete ? normalized : undefined);
  const academy = complete ? preview.data : null;

  // Visual state: request sent — feedback sheet at the bottom.
  const sentFeedback = sent ? (
    <FeedbackSheet
      tone="success"
      title="Pedido enviado"
      message={`Assim que um professor da ${academy?.gymName ?? 'academia'} aprovar, você entra.`}
      actionLabel="Continuar"
      onAction={() => router.replace('/')}
    />
  ) : undefined;

  const codeError = join.error
    ? errorMessage(join.error)
    : preview.error
      ? errorMessage(preview.error)
      : complete && preview.data === null
        ? 'Código não encontrado. Confira com seu professor.'
        : undefined;

  return (
    <Screen
      title="Entrar com código"
      onBack={() => router.back()}
      feedback={sentFeedback}
      footer={
        <Button
          title="Pedir para entrar"
          disabled={!academy}
          loading={join.isPending}
          onPress={() =>
            join.mutate(normalized, {
              onSuccess: () => {
                haptics.success();
                setSent(true);
              },
            })
          }
        />
      }
    >
      <Box gap="s16">
        <Text variant="body" color="textMuted">
          Peça o código de convite ao seu professor. Depois do pedido, ele precisa aprovar sua entrada.
        </Text>
        <TextField
          label="Código de convite"
          value={code}
          onChangeText={(text) => {
            setCode(text);
            if (join.isError) join.reset();
          }}
          maxLength={CODE_LENGTH + 2}
          autoCapitalize="characters"
          autoCorrect={false}
          errorMessage={codeError}
        />
        {complete && preview.isLoading ? <ActivityIndicator accessibilityLabel="Buscando academia" /> : null}
        {academy ? (
          // TODO(motion): academy card appearing once the code is recognized.
          <Card flexDirection="row" alignItems="center" gap="s16" accessibilityLabel={`Academia ${academy.gymName}`}>
            <AcademyLogo name={academy.gymName} url={academy.logoUrl} />
            <Box flex={1} gap="s4">
              <Text variant="captionCaps">Você vai entrar em</Text>
              <Text variant="title" numberOfLines={2}>
                {academy.gymName}
              </Text>
            </Box>
          </Card>
        ) : null}
      </Box>
    </Screen>
  );
}
