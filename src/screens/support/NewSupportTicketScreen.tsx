import { router } from 'expo-router';
import { useRef, useState } from 'react';

import { Box, Button, Screen, Text, TextField } from '@components';
import {
  isValidSupportMessage,
  isValidSupportSubject,
  SUPPORT_MESSAGE_MAX,
  SUPPORT_SUBJECT_MAX,
  SUPPORT_SUBJECT_MIN,
  useSupportMutations,
} from '@domain/Support';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

const back = () => (router.canGoBack() ? router.back() : router.replace('/suporte'));

/**
 * New ticket: subject + first message. It is tied to the active academy (so
 * the team knows which one); then the conversation replaces this screen.
 */
export function NewSupportTicketScreen() {
  const theme = useAppTheme();
  const { active } = useActiveGym();
  const { create } = useSupportMutations();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  // Synchronous lock: a fast double tap must not open two tickets.
  const submitting = useRef(false);

  const subjectError =
    subject.trim().length > 0 && !isValidSupportSubject(subject)
      ? `Use entre ${SUPPORT_SUBJECT_MIN} e ${SUPPORT_SUBJECT_MAX} caracteres.`
      : undefined;
  const valid = isValidSupportSubject(subject) && isValidSupportMessage(body);

  const submit = () => {
    if (!valid || submitting.current) return;
    submitting.current = true;
    create.mutate(
      { subject, body, academyId: active?.gymId ?? null },
      {
        onSuccess: (ticketId) => {
          haptics.success();
          router.replace({ pathname: '/suporte/[ticketId]', params: { ticketId } });
        },
        onError: () => {
          submitting.current = false;
        },
      },
    );
  };

  return (
    <Screen
      nativeHeader
      title="Novo chamado"
      onBack={back}
      footer={
        <Box gap="s8">
          {create.error ? (
            <Text variant="caption" color="danger">
              {errorMessage(create.error)}
            </Text>
          ) : null}
          <Button title="Enviar" disabled={!valid} loading={create.isPending} onPress={submit} />
        </Box>
      }
    >
      <Box gap="s24">
        <TextField
          label="Assunto"
          value={subject}
          onChangeText={setSubject}
          placeholder="Ex.: Não consigo fazer check-in"
          maxLength={SUPPORT_SUBJECT_MAX}
          errorMessage={subjectError}
          autoCapitalize="sentences"
          returnKeyType="next"
        />
        <Box gap="s8">
          <TextField
            label="Mensagem"
            value={body}
            onChangeText={setBody}
            placeholder="Conte o que aconteceu e em qual tela."
            maxLength={SUPPORT_MESSAGE_MAX}
            autoCapitalize="sentences"
            multiline
            style={{
              minHeight: theme.size.input * 3,
              textAlignVertical: 'top',
              paddingTop: theme.spacing.s12,
              paddingBottom: theme.spacing.s12,
            }}
          />
          <Text variant="caption">A equipe do Kimi responde por aqui, em Ajuda e suporte.</Text>
        </Box>
      </Box>
    </Screen>
  );
}
