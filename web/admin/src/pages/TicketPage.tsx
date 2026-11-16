import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { api, type Ticket, type TicketPriority, type TicketStatus } from '../api';
import { LoadFailed, Loading } from '../components/StateView';
import { PRIORITY_LABEL, TICKET_LABEL, errorMessage, formatDateTime } from '../format';
import { useLoad } from '../useLoad';
import { TICKET_TONE } from './Support';

export function TicketPage() {
  const { id = '' } = useParams();
  const ticket = useLoad(() => api.getTicket(id), [id]);

  if (ticket.error) return <LoadFailed error={ticket.error} onRetry={ticket.reload} />;
  if (ticket.loading && !ticket.data) return <Loading />;
  if (!ticket.data) return <p className="muted state">Chamado não encontrado.</p>;
  const t = ticket.data;

  return (
    <>
      <p className="breadcrumb">
        <Link to="/suporte">Suporte</Link> / #{t.number}
      </p>
      <h1>{t.subject}</h1>
      <p className="muted">
        <span className={`badge badge-${TICKET_TONE[t.status]}`}>{TICKET_LABEL[t.status]}</span>
        Aberto em {formatDateTime(t.created_at)} por <Link to={`/usuarios/${t.user_id}`}>{t.user_name || t.user_email}</Link>
        {t.user_email && <> · <a href={`mailto:${t.user_email}`}>{t.user_email}</a></>}
        {t.academy_id && (
          <>
            {' · '}
            <Link to={`/clientes/${t.academy_id}`}>{t.academy_name}</Link>
          </>
        )}
      </p>

      <TicketControls key={t.status + t.priority} ticket={t} onSaved={ticket.reload} />

      <ol className="thread">
        {t.messages.map(m => (
          <li key={m.id} className={m.is_staff ? 'card message message-staff' : 'card message'}>
            <div className="message-head">
              <strong>{m.is_staff ? `Suporte Kimi${m.author_name ? ` (${m.author_name})` : ''}` : t.user_name || 'Usuário'}</strong>
              <span className="muted small">{formatDateTime(m.created_at)}</span>
            </div>
            <p className="pre">{m.body}</p>
          </li>
        ))}
      </ol>

      <ReplyForm ticket={t} onSent={ticket.reload} />
    </>
  );
}

function TicketControls({ ticket, onSaved }: { ticket: Ticket; onSaved: () => void }) {
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = status !== ticket.status || priority !== ticket.priority;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.setTicket(ticket.id, status, priority);
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div className="card ticket-controls">
      <label className="field field-inline">
        <span>Situação</span>
        <select value={status} onChange={e => setStatus(e.target.value as TicketStatus)}>
          {(Object.keys(TICKET_LABEL) as TicketStatus[]).map(s => (
            <option key={s} value={s}>
              {TICKET_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="field field-inline">
        <span>Prioridade</span>
        <select value={priority} onChange={e => setPriority(e.target.value as TicketPriority)}>
          {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map(p => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="btn" disabled={!dirty || busy} onClick={save}>
        {busy ? 'Salvando…' : 'Salvar'}
      </button>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

function ReplyForm({ ticket, onSent }: { ticket: Ticket; onSent: () => void }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(close: boolean) {
    setBusy(true);
    setError(null);
    try {
      await api.replyTicket(ticket.id, body.trim(), close);
      setBody('');
      onSent();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="card form-stack"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void send(false);
      }}
    >
      <label className="field">
        <span>Responder como Suporte Kimi</span>
        <textarea rows={5} maxLength={4000} value={body} onChange={e => setBody(e.target.value)} />
      </label>
      <p className="muted small">A pessoa vê a resposta no app, em Perfil → Ajuda e suporte.</p>
      {error && <p className="form-error">{error}</p>}
      <div className="form-footer">
        <button type="button" className="btn" disabled={busy || !body.trim()} onClick={() => void send(true)}>
          Responder e encerrar
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy || !body.trim()}>
          {busy ? 'Enviando…' : 'Responder'}
        </button>
      </div>
    </form>
  );
}
