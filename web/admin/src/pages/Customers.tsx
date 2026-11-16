import { useDeferredValue, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, type CustomerRow } from '../api';
import { AcademyLogo } from '../components/AcademyLogo';
import { PageHeader } from '../components/PageHeader';
import { Segmented } from '../components/Segmented';
import { LoadFailed, Loading } from '../components/StateView';
import { csvMoney, downloadCsv } from '../csv';
import { PERIOD_LABEL, daySp, formatCents, formatDate, formatDateTime, subscriptionLabel, subscriptionTone } from '../format';
import { useLoad } from '../useLoad';

type Filter = 'all' | 'trialing' | 'trial_expired' | 'active' | 'overdue' | 'canceled';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'trialing', label: 'Em teste' },
  { value: 'trial_expired', label: 'Teste vencido' },
  { value: 'active', label: 'Ativos' },
  { value: 'overdue', label: 'Em atraso' },
  { value: 'canceled', label: 'Cancelados' },
];

const expired = (c: CustomerRow) => c.status === 'trialing' && !!c.trial_ends_at && new Date(c.trial_ends_at) < new Date();
const matches: Record<Filter, (c: CustomerRow) => boolean> = {
  all: () => true,
  trialing: c => c.status === 'trialing' && !expired(c),
  trial_expired: expired,
  active: c => c.status === 'active',
  overdue: c => c.status === 'past_due' || c.overdue_cents > 0,
  canceled: c => c.status === 'canceled',
};

/** "(11) 99999-0000" → wa.me link digits (Brazil when no country code). */
export const whatsappLink = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
};

export function Customers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const query = useDeferredValue(search.trim());
  const customers = useLoad(() => api.listCustomers(query), [query]);
  const rows = customers.data?.filter(matches[filter]) ?? [];

  function exportCsv() {
    downloadCsv('kimi-clientes.csv', rows, [
      ['Academia', c => c.name],
      ['Dono', c => c.owner_name ?? ''],
      ['E-mail', c => c.owner_email ?? ''],
      ['WhatsApp', c => c.owner_whatsapp ?? ''],
      ['Plano', c => c.plan_name ?? ''],
      ['Período', c => (c.billing_period ? PERIOD_LABEL[c.billing_period] : '')],
      ['Situação', c => subscriptionLabel(c.status, c.trial_ends_at)],
      ['Fim do teste', c => daySp(c.trial_ends_at)],
      ['MRR (R$)', c => csvMoney(c.mrr_cents)],
      ['Alunos ativos', c => c.students],
      ['Em atraso (R$)', c => csvMoney(c.overdue_cents)],
      ['Chamados abertos', c => c.open_tickets],
      ['Cliente desde', c => c.created_at.slice(0, 10)],
    ]);
  }

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Cada academia é um cliente do Kimi"
        actions={
          <button type="button" className="btn" onClick={exportCsv} disabled={!customers.data}>
            Exportar CSV
          </button>
        }
      />
      <div className="filters">
        <input
          type="search"
          className="search"
          placeholder="Buscar por academia, dono ou e-mail"
          aria-label="Buscar clientes"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Segmented label="Situação" value={filter} options={FILTERS} onChange={setFilter} />
      </div>
      {customers.error ? (
        <LoadFailed error={customers.error} onRetry={customers.reload} />
      ) : !customers.data ? (
        <Loading />
      ) : rows.length === 0 ? (
        <p className="muted state">Nenhum cliente encontrado.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Academia</th>
                <th>Dono</th>
                <th>Plano</th>
                <th>Situação</th>
                <th className="num">MRR</th>
                <th className="num">Alunos</th>
                <th className="num">Em atraso</th>
                <th>Última nota</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(c => (
                <tr key={c.academy_id} className="clickable" onClick={() => navigate(`/clientes/${c.academy_id}`)}>
                  <td>
                    <a className="row-title" href={`#/clientes/${c.academy_id}`} onClick={e => e.stopPropagation()}>
                      <AcademyLogo path={c.logo_path} name={c.name} size={32} />
                      {c.name}
                    </a>
                    {c.open_tickets > 0 && <div className="small text-warning">{c.open_tickets} chamado(s) aguardando</div>}
                  </td>
                  <td>
                    {c.owner_name || '—'}
                    {c.owner_email && <div className="muted small hide-mobile">{c.owner_email}</div>}
                    {c.owner_whatsapp && (
                      <a className="small" href={whatsappLink(c.owner_whatsapp)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                        WhatsApp {c.owner_whatsapp}
                      </a>
                    )}
                  </td>
                  <td>
                    {c.plan_name ?? '—'}
                    {c.billing_period && <div className="muted small">{PERIOD_LABEL[c.billing_period]}</div>}
                  </td>
                  <td>
                    <span className={`badge badge-${subscriptionTone(c.status, c.trial_ends_at)}`}>
                      {subscriptionLabel(c.status, c.trial_ends_at)}
                    </span>
                    {c.status === 'trialing' && <div className="muted small">até {formatDateTime(c.trial_ends_at).slice(0, 10)}</div>}
                  </td>
                  <td className="num">{formatCents(c.mrr_cents)}</td>
                  <td className="num">{c.students}</td>
                  <td className="num">{c.overdue_cents > 0 ? <span className="text-danger">{formatCents(c.overdue_cents)}</span> : '—'}</td>
                  <td>{c.last_note_at ? formatDate(c.last_note_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
