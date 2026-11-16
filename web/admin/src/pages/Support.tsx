import { useDeferredValue, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, type TicketStatus } from '../api';
import { PageHeader } from '../components/PageHeader';
import { Segmented } from '../components/Segmented';
import { LoadFailed, Loading } from '../components/StateView';
import { downloadCsv } from '../csv';
import { PRIORITY_LABEL, TICKET_LABEL, formatDateTime } from '../format';
import { useLoad } from '../useLoad';

type Filter = TicketStatus | 'all';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'open', label: 'Aguardando suporte' },
  { value: 'answered', label: 'Respondidos' },
  { value: 'closed', label: 'Encerrados' },
  { value: 'all', label: 'Todos' },
];
export const TICKET_TONE: Record<TicketStatus, string> = { open: 'pending', answered: 'instructor', closed: 'muted' };

export function Support() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('open');
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim());
  const tickets = useLoad(() => api.listTickets(filter === 'all' ? null : filter, query), [filter, query]);

  function exportCsv() {
    if (!tickets.data) return;
    downloadCsv('kimi-chamados.csv', tickets.data, [
      ['Número', t => t.number],
      ['Assunto', t => t.subject],
      ['Situação', t => TICKET_LABEL[t.status]],
      ['Prioridade', t => PRIORITY_LABEL[t.priority]],
      ['Usuário', t => t.user_name],
      ['E-mail', t => t.user_email ?? ''],
      ['Academia', t => t.academy_name ?? ''],
      ['Mensagens', t => t.messages],
      ['Aberto em', t => t.created_at.slice(0, 10)],
      ['Última mensagem', t => t.last_message_at.slice(0, 16).replace('T', ' ')],
    ]);
  }

  return (
    <>
      <PageHeader
        title="Suporte"
        subtitle="Chamados abertos pelo app em Perfil → Ajuda e suporte"
        actions={
          <button type="button" className="btn" onClick={exportCsv} disabled={!tickets.data}>
            Exportar CSV
          </button>
        }
      />
      <div className="filters">
        <input
          type="search"
          className="search"
          placeholder="Buscar por assunto, número, pessoa, e-mail ou academia"
          aria-label="Buscar chamados"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Segmented label="Situação" value={filter} options={FILTERS} onChange={setFilter} />
      </div>
      {tickets.error ? (
        <LoadFailed error={tickets.error} onRetry={tickets.reload} />
      ) : !tickets.data ? (
        <Loading />
      ) : tickets.data.length === 0 ? (
        <p className="muted state">Nenhum chamado aqui.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Assunto</th>
                <th>Pessoa</th>
                <th>Academia</th>
                <th>Situação</th>
                <th>Última mensagem</th>
              </tr>
            </thead>
            <tbody>
              {tickets.data.map(t => (
                <tr key={t.id} className="clickable" onClick={() => navigate(`/suporte/${t.id}`)}>
                  <td>{t.number}</td>
                  <td>
                    <a className="row-title" href={`#/suporte/${t.id}`} onClick={e => e.stopPropagation()}>
                      {t.subject}
                    </a>
                    <div className="muted small">{t.messages} mensagem(ns)</div>
                  </td>
                  <td>
                    {t.user_name || 'Sem nome'}
                    {t.user_email && <div className="muted small hide-mobile">{t.user_email}</div>}
                  </td>
                  <td>{t.academy_name ?? '—'}</td>
                  <td>
                    <span className={`badge badge-${TICKET_TONE[t.status]}`}>{TICKET_LABEL[t.status]}</span>
                    {t.priority !== 'normal' && (
                      <span className={`badge ${t.priority === 'high' ? 'badge-rejected' : ''}`}>{PRIORITY_LABEL[t.priority]}</span>
                    )}
                  </td>
                  <td>{formatDateTime(t.last_message_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
