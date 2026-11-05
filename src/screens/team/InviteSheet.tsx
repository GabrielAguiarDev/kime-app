import { router } from 'expo-router';
import { ActivityIndicator, Alert, Share } from 'react-native';

import { Box, Button, Card, Text, TextButton } from '@components';
import { useRegenerateStudentCode, useStudentCode } from '@domain/Gym';
import { errorMessage } from '@infra';
import { SheetForm } from '@screens/professor/shared';
import { joinCodeMessage } from '@utils/deepLinks';
import { haptics } from '@utils/haptics';

/**
 * Equipe → "Convidar": the student code in big type and "Compartilhar código";
 * the owner also regenerates it and reaches the professor codes.
 * Confirmations use the system alert: a sheet cannot open over this sheet on iOS.
 */
export function InviteSheet({
  gymId,
  gymName,
  isOwner,
  onClose,
}: {
  gymId: string;
  gymName: string;
  isOwner: boolean;
  onClose: () => void;
}) {
  const code = useStudentCode(gymId);
  const regenerate = useRegenerateStudentCode(gymId);

  const share = () => {
    if (!code.data) return;
    void Share.share({ message: joinCodeMessage(gymName, code.data, 'student') });
  };

  const askRegenerate = () =>
    Alert.alert('Gerar novo código?', 'O código atual para de funcionar. Pedidos já enviados com ele continuam valendo.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Gerar novo código',
        style: 'destructive',
        onPress: () =>
          regenerate.mutate(undefined, {
            onSuccess: () => haptics.success(),
            onError: (e) => Alert.alert('Código', errorMessage(e)),
          }),
      },
    ]);

  return (
    <SheetForm
      title="Convidar alunos"
      actions={
        <>
          <Button title="Compartilhar código" icon="share" disabled={!code.data} onPress={share} />
          {isOwner ? (
            <TextButton
              title="Códigos de professor"
              onPress={() => {
                onClose();
                router.push('/convites');
              }}
            />
          ) : null}
        </>
      }
    >
      <Text variant="body" color="textMuted">
        Quem entrar com este código pede para fazer parte da {gymName}. Você aprova o pedido.
      </Text>
      <Card alignItems="center" gap="s8">
        <Text variant="captionCaps">Código de aluno</Text>
        {code.isLoading ? <ActivityIndicator /> : null}
        {code.data ? (
          <Text variant="displayLg" letterSpacing={4} selectable accessibilityLabel={`Código ${code.data.split('').join(' ')}`}>
            {code.data}
          </Text>
        ) : null}
        {code.isError ? (
          <Text variant="caption" color="danger">
            {errorMessage(code.error)}
          </Text>
        ) : null}
      </Card>
      {isOwner ? (
        <Box alignItems="center">
          <TextButton title="Gerar novo código" color="danger" fullWidth={false} disabled={regenerate.isPending} onPress={askRegenerate} />
        </Box>
      ) : null}
    </SheetForm>
  );
}
