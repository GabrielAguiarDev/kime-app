import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { supportService as service } from '../supportService';
import type { SupportTicketInput } from '../supportTypes';

/** The person's tickets (default polling: a reply from Kimi shows up by itself). */
export function useSupportTickets() {
  return useQuery({
    queryKey: [QueryKeys.SupportTickets],
    queryFn: service.listTickets,
  });
}

/** One ticket and its messages (oldest first). */
export function useSupportTicket(ticketId: string | undefined) {
  const ticket = useQuery({
    queryKey: [QueryKeys.SupportTicket, ticketId, 'ticket'],
    queryFn: () => service.getTicket(ticketId!),
    enabled: !!ticketId,
  });
  const messages = useQuery({
    queryKey: [QueryKeys.SupportTicket, ticketId, 'messages'],
    queryFn: () => service.listMessages(ticketId!),
    enabled: !!ticketId,
  });
  return { ticket, messages };
}

/** Open, reply, close: every write refreshes the list and the ticket. */
export function useSupportMutations() {
  const queryClient = useQueryClient();
  const refresh = (ticketId?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [QueryKeys.SupportTickets] }),
      ticketId ? queryClient.invalidateQueries({ queryKey: [QueryKeys.SupportTicket, ticketId] }) : undefined,
    ]);
  return {
    create: useMutation({
      mutationFn: (input: SupportTicketInput) => service.create(input),
      onSuccess: () => refresh(),
    }),
    reply: useMutation({
      mutationFn: ({ ticketId, body }: { ticketId: string; body: string }) => service.reply(ticketId, body),
      onSuccess: (_, { ticketId }) => refresh(ticketId),
    }),
    close: useMutation({
      mutationFn: (ticketId: string) => service.close(ticketId),
      onSuccess: (_, ticketId) => refresh(ticketId),
    }),
  };
}
