import { supabase } from '@infra/supabase';

// Reads: the person's own rows (RLS, select only). Writes: RPCs only.
const TICKET_COLUMNS = 'id, number, academy_id, subject, status, last_message_at, closed_at, created_at';

/** The caller's tickets, most recent activity first. */
async function listTickets() {
  const { data, error } = await supabase
    .from('support_tickets')
    .select(TICKET_COLUMNS)
    .order('last_message_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** One ticket; null when it does not exist or is not the caller's. */
async function getTicket(id: string) {
  const { data, error } = await supabase.from('support_tickets').select(TICKET_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Messages of a ticket, oldest first. */
async function listMessages(ticketId: string) {
  const { data, error } = await supabase
    .from('support_messages')
    .select('id, ticket_id, is_staff, body, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

/** Opens a ticket with its first message; returns the ticket id. */
async function create(subject: string, body: string, academyId: string | null) {
  const { data, error } = await supabase.rpc('create_support_ticket', {
    p_subject: subject,
    p_body: body,
    // The RPC defaults it to null; omit instead of sending null (typed as optional string).
    ...(academyId ? { p_academy_id: academyId } : {}),
  });
  if (error) throw error;
  return data;
}

/** New message from the person (re-opens a closed ticket). */
async function reply(ticketId: string, body: string) {
  const { error } = await supabase.rpc('reply_support_ticket', { p_ticket_id: ticketId, p_body: body });
  if (error) throw error;
}

async function close(ticketId: string) {
  const { error } = await supabase.rpc('close_support_ticket', { p_ticket_id: ticketId });
  if (error) throw error;
}

export type SupportTicketRowApi = Awaited<ReturnType<typeof listTickets>>[number];
export type SupportMessageRowApi = Awaited<ReturnType<typeof listMessages>>[number];

export const supportApi = { listTickets, getTicket, listMessages, create, reply, close };
