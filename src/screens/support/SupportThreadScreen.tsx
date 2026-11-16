import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import { Box, Button, Card, EmptyState, Icon, LoadError, Screen, Spinner, Text, TextButton, TextField } from '@components';
import {
  isValidSupportMessage,
  SUPPORT_MESSAGE_MAX,
  supportTimeLabel,
  useSupportMutations,
  useSupportTicket,
  type SupportMessage,
  type SupportTicket,
} from '@domain/Support';
import { errorMessage } from '@infra';
import { useConfirm } from '@services/confirm';
import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

import { SUPPORT_TIME_ZONE, SupportStatusBadge } from './SupportTicketCard';

const back = () => (router.canGoBack() ? router.back() : router.replace('/suporte'));

/**
 * One ticket: subject and status, then the messages in order (Kimi's replies
 * as "Suporte Kimi"). The reply box sits in the Screen's endFooter: the fixed
 * footer does not rise with the keyboard (project decision), the end of the
 * scroll does. A closed ticket has no reply box. Polls like every screen, so
 * a reply from the team shows up by itself.
 */
export function SupportThreadScreen() {
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
  const { ticket, messages } = useSupportTicket(ticketId);

  if (ticket.isLoading || messages.isLoading) {
    return (
      <Screen nativeHeader title="Chamado" onBack={back}>
        <Spinner accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  // Only without data: a failed background refresh keeps the conversation (and the draft reply).
  if ((ticket.isError && !ticket.data) || (messages.isError && !messages.data)) {
    return (
      <Screen nativeHeader title="Chamado" onBack={back}>
        <LoadError
          title="Não foi possível carregar o chamado"
          onRetry={() => {
            void ticket.refetch();
            void messages.refetch();
          }}
        />
      </Screen>
    );
  }
  if (!ticket.data) {
    return (
      <Screen nativeHeader title="Chamado" onBack={back}>
        <EmptyState title="Chamado não encontrado." />
      </Screen>
    );
  }
  return <Thread ticket={ticket.data} messages={messages.data ?? []} />;
}

function Thread({ ticket, messages }: { ticket: SupportTicket; messages: SupportMessage[] }) {
  const closed = ticket.status === 'closed';
  return (
    <Screen
      nativeHeader
      title={`Chamado #${ticket.number}`}
      largeTitle={false}
      onBack={back}
      endFooter={
        closed ? (
          <Text variant="caption" textAlign="center">
            Chamado encerrado.
          </Text>
        ) : (
          <ReplyBox ticketId={ticket.id} />
        )
      }
    >
      <Box gap="s24">
        <Box gap="s8">
          <SupportStatusBadge status={ticket.status} />
          <Text variant="heading" accessibilityRole="header">
            {ticket.subject}
          </Text>
        </Box>
        <Box gap="s12">
          {messages.map((m) => (
            <MessageCard key={m.id} message={m} />
          ))}
        </Box>
      </Box>
    </Screen>
  );
}

function MessageCard({ message: m }: { message: SupportMessage }) {
  const { size } = useAppTheme();
  const author = m.isStaff ? 'Suporte Kimi' : 'Você';
  return (
    <Card gap="s8">
      <Box flexDirection="row" alignItems="center" gap="s8">
        <Icon name={m.isStaff ? 'support' : 'user'} size={size.badgeIcon} color={m.isStaff ? 'accent' : 'textMuted'} />
        <Text variant="caption" color={m.isStaff ? 'accent' : 'textMuted'} flex={1} numberOfLines={1}>
          {`${author} · ${supportTimeLabel(m.createdAt, SUPPORT_TIME_ZONE)}`}
        </Text>
      </Box>
      <Text variant="body" selectable>
        {m.body}
      </Text>
    </Card>
  );
}

/** Reply (multiline) + "Enviar", and "Encerrar chamado" with a confirmation. */
function ReplyBox({ ticketId }: { ticketId: string }) {
  const theme = useAppTheme();
  const confirm = useConfirm();
  const { reply, close } = useSupportMutations();
  const [body, setBody] = useState('');
  // Synchronous lock: a fast double tap must not send the message twice.
  const sending = useRef(false);
  const valid = isValidSupportMessage(body);

  const send = () => {
    if (!valid || sending.current) return;
    sending.current = true;
    reply.mutate(
      { ticketId, body },
      {
        onSuccess: () => {
          haptics.success();
          setBody('');
        },
        onSettled: () => {
          sending.current = false;
        },
      },
    );
  };

  const askClose = async () => {
    const ok = await confirm({
      title: 'Encerrar chamado?',
      message: 'Use quando sua dúvida estiver resolvida. Para um assunto novo, abra outro chamado.',
      confirmLabel: 'Encerrar chamado',
    });
    if (!ok) return;
    close.mutate(ticketId, {
      onSuccess: () => haptics.success(),
      onError: (e) => Alert.alert('Ajuda e suporte', errorMessage(e)),
    });
  };

  return (
    <Box gap="s12">
      <TextField
        label="Responder"
        value={body}
        onChangeText={setBody}
        placeholder="Escreva sua mensagem"
        maxLength={SUPPORT_MESSAGE_MAX}
        autoCapitalize="sentences"
        multiline
        style={{
          minHeight: theme.size.input * 2,
          textAlignVertical: 'top',
          paddingTop: theme.spacing.s12,
          paddingBottom: theme.spacing.s12,
        }}
      />
      {reply.error ? (
        <Text variant="caption" color="danger">
          {errorMessage(reply.error)}
        </Text>
      ) : null}
      <Button title="Enviar" disabled={!valid} loading={reply.isPending} onPress={send} />
      <TextButton title="Encerrar chamado" color="danger" disabled={close.isPending} onPress={() => void askClose()} />
    </Box>
  );
}
