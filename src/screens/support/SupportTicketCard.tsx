import { router } from 'expo-router';

import { Box, Card, Icon, StatusBadge, Text } from '@components';
import { supportStatusLabel, supportTimeLabel, type SupportTicket, type SupportTicketStatus } from '@domain/Support';

/** Calendar of the labels (same fixed zone as the academies). */
export const SUPPORT_TIME_ZONE = 'America/Sao_Paulo';

export const openTicket = (ticketId: string) => router.push({ pathname: '/suporte/[ticketId]', params: { ticketId } });

/**
 * Status in the existing badge: waiting for Kimi = pending, Kimi replied =
 * confirmed, closed = rejected tone with a lock (the badge has no neutral tone).
 */
export function SupportStatusBadge({ status }: { status: SupportTicketStatus }) {
  const label = supportStatusLabel(status);
  if (status === 'answered') return <StatusBadge status="confirmed" label={label} />;
  if (status === 'closed') return <StatusBadge status="rejected" icon="locked" label={label} />;
  return <StatusBadge status="pending" label={label} />;
}

/** One ticket: status, subject, number and the last activity; opens the conversation. */
export function SupportTicketCard({ ticket: t }: { ticket: SupportTicket }) {
  const when = supportTimeLabel(t.lastMessageAt, SUPPORT_TIME_ZONE);
  return (
    <Card
      onPress={() => openTicket(t.id)}
      accessibilityLabel={`${t.subject}. ${supportStatusLabel(t.status)}. Chamado ${t.number}, ${when}. Abrir`}
      flexDirection="row"
      alignItems="center"
      gap="s12"
    >
      <Box flex={1} gap="s8">
        <SupportStatusBadge status={t.status} />
        <Text variant="bodyStrong" color={t.status === 'closed' ? 'textMuted' : 'text'} numberOfLines={2}>
          {t.subject}
        </Text>
        <Text variant="caption">{`Chamado #${t.number} · ${when}`}</Text>
      </Box>
      <Icon name="chevronRight" color="textMuted" />
    </Card>
  );
}
