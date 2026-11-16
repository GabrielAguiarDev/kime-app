import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api';
import { BarChart } from '../components/BarChart';
import { PageHeader } from '../components/PageHeader';
import { Segmented } from '../components/Segmented';
import { LoadFailed, Loading } from '../components/StateView';
import { csvMoney, downloadCsv } from '../csv';
import { formatCents, formatCentsShort, formatMonth, formatMonthLong, formatNumber } from '../format';
import { useLoad } from '../useLoad';

const PERIODS = [
  { value: '6', label: '6 meses' },
  { value: '12', label: '12 meses' },
  { value: '24', label: '24 meses' },
];
const count = (v: number) => formatNumber(Math.round(v));

export function Reports() {
  const [months, setMonths] = useState('12');
  const report = useLoad(() => api.report(Number(months)), [months]);
  const r = report.data;

  function exportCsv() {
    if (!r) return;
    downloadCsv(`kimi-relatorio-${months}m.csv`, r.months, [
      ['Mês', m => m.month.slice(0, 7)],
      ['Faturado (R$)', m => csvMoney(m.invoiced_cents)],
      ['Recebido (R$)', m => csvMoney(m.received_cents)],
      ['Novas academias', m => m.new_academies],
      ['Novos usuários', m => m.new_users],
      ['Cancelamentos', m => m.canceled],
      ['Check-ins confirmados', m => m.checkins],
      ['Alunos treinando', m => m.training_students],
    ]);
  }

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle="Receita, crescimento e uso, mês a mês"
        actions={
          <>
            <Segmented label="Período" value={months} options={PERIODS} onChange={setMonths} />
            <button type="button" className="btn" onClick={exportCsv} disabled={!r}>
              Exportar CSV
            </button>
          </>
        }
      />
      {report.error ? (
        <LoadFailed error={report.error} onRetry={report.reload} />
      ) : !r ? (
        <Loading />
      ) : (
        <>
          <div className="grid-2">
            <section className="card">
              <h2 className="card-title">Receita</h2>
              <BarChart
                label="Faturado e recebido por mês"
                data={r.months.map(m => ({ label: formatMonth(m.month), values: [m.invoiced_cents, m.received_cents] }))}
                series={[
                  { name: 'Faturado', color: 'var(--chart-1)' },
                  { name: 'Recebido', color: 'var(--chart-2)' },
                ]}
                format={formatCents}
                formatTick={formatCentsShort}
                minStep={100}
              />
            </section>
            <section className="card">
              <h2 className="card-title">Crescimento</h2>
              <BarChart
                label="Novas academias e novos usuários por mês"
                data={r.months.map(m => ({ label: formatMonth(m.month), values: [m.new_academies, m.new_users] }))}
                series={[
                  { name: 'Novas academias', color: 'var(--chart-1)' },
                  { name: 'Novos usuários', color: 'var(--chart-2)' },
                ]}
                format={count}
              />
            </section>
            <section className="card">
              <h2 className="card-title">Check-ins confirmados</h2>
              <BarChart
                label="Check-ins confirmados por mês"
                data={r.months.map(m => ({ label: formatMonth(m.month), values: [m.checkins] }))}
                series={[{ name: 'Check-ins', color: 'var(--chart-1)' }]}
                format={count}
              />
            </section>
            <section className="card">
              <h2 className="card-title">Alunos que treinaram</h2>
              <BarChart
                label="Alunos com pelo menos um check-in confirmado no mês"
                data={r.months.map(m => ({ label: formatMonth(m.month), values: [m.training_students] }))}
                series={[{ name: 'Alunos', color: 'var(--chart-1)' }]}
                format={count}
              />
            </section>
          </div>

          <h2>Mês a mês</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th className="num">Faturado</th>
                  <th className="num">Recebido</th>
                  <th className="num">Novas academias</th>
                  <th className="num">Novos usuários</th>
                  <th className="num">Cancelamentos</th>
                  <th className="num">Check-ins</th>
                  <th className="num">Alunos treinando</th>
                </tr>
              </thead>
              <tbody>
                {[...r.months].reverse().map(m => (
                  <tr key={m.month}>
                    <td>{formatMonthLong(m.month)}</td>
                    <td className="num">{formatCents(m.invoiced_cents)}</td>
                    <td className="num">{formatCents(m.received_cents)}</td>
                    <td className="num">{m.new_academies}</td>
                    <td className="num">{m.new_users}</td>
                    <td className="num">{m.canceled}</td>
                    <td className="num">{formatNumber(m.checkins)}</td>
                    <td className="num">{formatNumber(m.training_students)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Academias mais ativas no período</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Academia</th>
                  <th className="num">Alunos ativos</th>
                  <th className="num">Check-ins</th>
                </tr>
              </thead>
              <tbody>
                {r.top_academies.map(a => (
                  <tr key={a.id}>
                    <td>
                      <Link to={`/clientes/${a.id}`} className="row-title">
                        {a.name}
                      </Link>
                    </td>
                    <td className="num">{a.students}</td>
                    <td className="num">{formatNumber(a.checkins)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
