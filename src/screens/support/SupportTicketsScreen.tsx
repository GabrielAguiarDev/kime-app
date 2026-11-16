import { router } from 'expo-router';

import { Box, EmptyState, HeaderButton, LoadError, Screen, Spinner, Text } from '@components';
import { splitTickets, useSupportTickets, type SupportTicket } from '@domain/Support';

import { SupportTicketCard } from './SupportTicketCard';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
const newTicket = () => router.push('/suporte/novo');

/**
 * Ajuda e suporte: the person's conversations with the Kimi team, most recent
 * activity first; closed ones under "Encerrados". New ticket from the header.
 * Not gated by the fee block (a blocked student can still ask for help).
 */
export function SupportTicketsScreen() {
  const tickets = useSupportTickets();
  const headerRight = <HeaderButton icon="plus" accessibilityLabel="Novo chamado" onPress={newTicket} />;

  if (tickets.isLoading) {
    return (
      <Screen nativeHeader title="Ajuda e suporte" onBack={back} headerRight={headerRight}>
        <Spinner accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if (tickets.isError && !tickets.data) {
    return (
      <Screen nativeHeader title="Ajuda e suporte" onBack={back} headerRight={headerRight}>
        <LoadError title="Não foi possível carregar seus chamados" onRetry={() => void tickets.refetch()} />
      </Screen>
    );
  }

  const { active, closed } = splitTickets(tickets.data ?? []);

  return (
    <Screen nativeHeader title="Ajuda e suporte" onBack={back} headerRight={headerRight}>
      <Box gap="s24">
        {active.length === 0 ? (
          <EmptyState
            visual="icon"
            icon="support"
            title="Nenhum chamado aberto."
            description="Dúvida ou problema no app? Abra um chamado no botão do topo. A equipe do Kimi responde por aqui."
          />
        ) : (
          <TicketList list={active} />
        )}
        {closed.length > 0 ? (
          <Box gap="s12">
            <Text variant="captionCaps">Encerrados</Text>
            <TicketList list={closed} />
          </Box>
        ) : null}
      </Box>
    </Screen>
  );
}

function TicketList({ list }: { list: SupportTicket[] }) {
  return (
    <Box gap="s12">
      {list.map((t) => (
        <SupportTicketCard key={t.id} ticket={t} />
      ))}
    </Box>
  );
}
