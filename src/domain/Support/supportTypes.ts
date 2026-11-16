/**
 * "Ajuda e suporte": a conversation between the person and the Kimi team.
 * open = waiting for Kimi, answered = Kimi replied (waiting for the person),
 * closed = ended. The app hides the reply box on a closed ticket (the RPC
 * would re-open it on a reply, but that path is not offered in the UI).
 */
export type SupportTicketStatus = 'open' | 'answered' | 'closed';

export interface SupportTicket {
  id: string;
  /** Sequential number shown to the person ("Chamado #12"). */
  number: number;
  /** Academy the ticket is about (the active one when it was opened); null = none. */
  academyId: string | null;
  subject: string;
  status: SupportTicketStatus;
  lastMessageAt: string;
  closedAt: string | null;
  createdAt: string;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  /** True = written by the Kimi team ("Suporte Kimi"). */
  isStaff: boolean;
  body: string;
  createdAt: string;
}

export interface SupportTicketInput {
  subject: string;
  body: string;
  academyId: string | null;
}
