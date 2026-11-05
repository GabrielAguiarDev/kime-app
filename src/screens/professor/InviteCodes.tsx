import { Alert } from 'react-native';

import { Box, Text } from '@components';
import { useInviteCodes, useRegenerateInviteCode, type CodeType } from '@domain/Gym';
import { errorMessage } from '@infra';
import { InviteCodeCard } from '@screens/team/InviteCodeCard';
import { haptics } from '@utils/haptics';

/**
 * The academy's two fixed codes, stacked: student (everyone on the staff) and
 * professor (owner only). The owner shares and regenerates both; professors
 * only share the student code. Confirmation uses the system alert: this also
 * renders inside a sheet (Equipe → Convidar), where a second sheet cannot open.
 */
export function InviteCodesSection({
  gymId,
  gymName,
  isOwner,
  only,
}: {
  gymId: string;
  gymName: string;
  isOwner: boolean;
  /** Just one of the codes (Equipe → Convidar shows one at a time). */
  only?: CodeType;
}) {
  const codes = useInviteCodes(gymId);
  const regenerate = useRegenerateInviteCode(gymId);

  const askRegenerate = (codeType: CodeType) =>
    Alert.alert(
      'Gerar novo código?',
      `O código de ${codeType === 'student' ? 'aluno' : 'professor'} atual para de funcionar. Pedidos já enviados com ele continuam valendo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Gerar novo código',
          style: 'destructive',
          onPress: () =>
            regenerate.mutate(codeType, {
              onSuccess: () => haptics.success(),
              onError: (e) => Alert.alert('Código', errorMessage(e)),
            }),
        },
      ],
    );

  const types: CodeType[] = only ? [only] : isOwner ? ['student', 'instructor'] : ['student'];
  return (
    <Box gap="cardGap">
      {types.map((t) => (
        <InviteCodeCard
          key={t}
          codeType={t}
          code={codes.data?.[t]}
          loading={codes.isLoading}
          gymName={gymName}
          onRegenerate={isOwner ? () => askRegenerate(t) : undefined}
          regenerating={regenerate.isPending && regenerate.variables === t}
        />
      ))}
      {codes.isError ? (
        <Text variant="caption" color="danger">
          {errorMessage(codes.error)}
        </Text>
      ) : null}
    </Box>
  );
}
