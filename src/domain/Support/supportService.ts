import { toAppError } from '@infra/supabase';

import { supportApi as api, type SupportMessageRowApi, type SupportTicketRowApi } from './supportApi';
import { toSupportStatus } from './supportRules';
import type { SupportMessage, SupportTicket, SupportTicketInput } from './supportTypes';

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    throw toAppError(e);
  }
}

function toTicket(row: SupportTicketRowApi): SupportTicket {
  return {
    id: row.id,
    number: row.number,
    academyId: row.academy_id,
    subject: row.subject,
    status: toSupportStatus(row.status),
    lastMessageAt: row.last_message_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
  };
}

function toMessage(row: SupportMessageRowApi): SupportMessage {
  return { id: row.id, ticketId: row.ticket_id, isStaff: row.is_staff, body: row.body, createdAt: row.created_at };
}

export const supportService = {
  listTickets: () => call(async () => (await api.listTickets()).map(toTicket)),
  getTicket: (id: string) =>
    call(async () => {
      const row = await api.getTicket(id);
      return row ? toTicket(row) : null;
    }),
  listMessages: (ticketId: string) => call(async () => (await api.listMessages(ticketId)).map(toMessage)),
  create: (input: SupportTicketInput) => call(() => api.create(input.subject.trim(), input.body.trim(), input.academyId)),
  reply: (ticketId: string, body: string) => call(() => api.reply(ticketId, body.trim())),
  close: (ticketId: string) => call(() => api.close(ticketId)),
};
