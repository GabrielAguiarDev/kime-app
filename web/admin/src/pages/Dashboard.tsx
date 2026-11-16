import { Link } from 'react-router';
import { api } from '../api';
import { AcademyLogo } from '../components/AcademyLogo';
import { BarChart } from '../components/BarChart';
import { PageHeader } from '../components/PageHeader';
import { Stat } from '../components/Stat';
import { LoadFailed, Loading } from '../components/StateView';
import {
  PRIORITY_LABEL,
  formatCents,
  formatCentsShort,
  formatDate,
  formatDateTime,
  formatMonth,
  formatNumber,
} from '../format';
import { useLoad } from '../useLoad';

export function Dashboard() {
  const dash = useLoad(() => api.dashboard(), []);
  const report = useLoad(() => api.report(6), []);

  if (dash.error) return <LoadFailed error={dash.error} onRetry={dash.reload} />;
  if (!dash.data) return <Loading />;
  const d = dash.data;
  const plansTotal = d.plans.reduce((sum, p) => sum + p.academies, 0);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Visão geral do Kimi" />

      <section className="stats" aria-label="Receita">
        <Stat label="MRR (receita mensal recorrente)" value={formatCentsShort(d.mrr_cents)} hint={`ARR ${formatCentsShort(d.mrr_cents * 12)}`} to="/financeiro" />
        <Stat label="Recebido no mês" value={formatCentsShort(d.received_month_cents)} hint={`${formatCentsShort(d.open_month_cents)} em aberto do mês`} to="/financeiro" />
        <Stat
          label="Em atraso"
          value={formatCentsShort(d.overdue_cents)}
          hint={`${d.overdue_count} fatura(s)`}
          tone={d.overdue_count > 0 ? 'danger' : undefined}
          to="/financeiro"
        />
        <Stat label="Assinantes pagantes" value={formatNumber(d.paying)} hint={`${d.canceled} cancelada(s)`} to="/clientes" />
        <Stat
          label="Em teste"
          value={formatNumber(d.trialing)}
          hint={`${d.trial_ending_7d} vence(m) em 7 dias · ${d.trial_expired} vencido(s)`}
          tone={d.trial_expired > 0 ? 'warning' : undefined}
          to="/clientes"
        />
      </section>

      <section className="stats" aria-label="Uso">
        <Stat label="Academias" value={formatNumber(d.academies)} hint={`+${d.new_academies_30d} em 30 dias`} to="/academias" />
        <Stat label="Usuários" value={formatNumber(d.users)} hint={`+${d.new_users_30d} em 30 dias`} to="/usuarios" />
        <Stat label="Alunos ativos" value={formatNumber(d.active_students)} hint={`${d.active_staff} donos e professores`} />
        <Stat label="Check-ins em 30 dias" value={formatNumber(d.checkins_30d)} hint={`${d.pending_requests} pedido(s) de entrada pendente(s)`} />
        <Stat
          label="Chamados aguardando"
          value={formatNumber(d.open_tickets)}
          tone={d.open_tickets > 0 ? 'warning' : undefined}
          to="/suporte"
        />
      </section>

      <div className="grid-2">
        <section className="card">
          <h2 className="card-title">Receita dos últimos 6 meses</h2>
          {report.error ? (
            <LoadFailed error={report.error} onRetry={report.reload} />
          ) : !report.data ? (
            <Loading />
          ) : (
            <BarChart
              label="Faturado e recebido por mês"
              data={report.data.months.map(m => ({
                label: formatMonth(m.month),
                values: [m.invoiced_cents, m.received_cents],
              }))}
              series={[
                { name: 'Faturado', color: 'var(--chart-1)' },
                { name: 'Recebido', color: 'var(--chart-2)' },
              ]}
              format={formatCents}
              formatTick={formatCentsShort}
              minStep={100}
            />
          )}
          <p className="small">
            <Link to="/relatorios">Ver relatórios completos</Link>
          </p>
        </section>

        <section className="card">
          <h2 className="card-title">Academias por plano</h2>
          <ul className="bars-list">
            {d.plans.map(p => (
              <li key={p.code}>
                <span>{p.name}</span>
                <span className="meter" aria-hidden="true">
                  <span style={{ width: `${plansTotal ? (p.academies / plansTotal) * 100 : 0}%` }} />
                </span>
                <strong>{p.academies}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2 className="card-title">Chamados aguardando resposta</h2>
          {d.recent_tickets.length === 0 ? (
            <p className="muted">Nenhum chamado aguardando.</p>
          ) : (
            <ul className="list">
              {d.recent_tickets.map(t => (
                <li key={t.id}>
                  <Link to={`/suporte/${t.id}`} className="row-title">
                    #{t.number} {t.subject}
                  </Link>
                  <span className="muted small">
                    {t.priority === 'high' && <span className="badge badge-rejected">{PRIORITY_LABEL.high}</span>}
                    {formatDateTime(t.last_message_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <h2 className="card-title">Academias recentes</h2>
          <ul className="list">
            {d.recent_academies.map(a => (
              <li key={a.id}>
                <Link to={`/clientes/${a.id}`} className="row-title">
                  <AcademyLogo path={a.logo_path} name={a.name} size={28} />
                  {a.name}
                </Link>
                <span className="muted small">{formatDate(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
