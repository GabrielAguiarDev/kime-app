import { useDeferredValue, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api';
import { AcademyLogo } from '../components/AcademyLogo';
import { PageHeader } from '../components/PageHeader';
import { LoadFailed, Loading } from '../components/StateView';
import { downloadCsv } from '../csv';
import { formatDate } from '../format';
import { useLoad } from '../useLoad';

export function Academies() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim());
  const academies = useLoad(() => api.listAcademies(query), [query]);
  const plans = useLoad(() => api.listPlans(), []);
  const planName = (code: string | null) => (code ? (plans.data?.find(p => p.code === code)?.name ?? code) : '—');

  function exportCsv() {
    if (!academies.data) return;
    downloadCsv('kimi-academias.csv', academies.data, [
      ['Academia', a => a.name],
      ['Dono', a => a.owner_name ?? ''],
      ['E-mail do dono', a => a.owner_email ?? ''],
      ['Plano', a => planName(a.plan_tier)],
      ['Alunos ativos', a => a.students],
      ['Donos e professores', a => a.staff],
      ['Pedidos pendentes', a => a.pending],
      ['Criada em', a => a.created_at.slice(0, 10)],
    ]);
  }

  return (
    <>
      <PageHeader
        title="Academias"
        subtitle="Membros, papéis e pedidos de entrada de cada academia"
        actions={
          <button type="button" className="btn" onClick={exportCsv} disabled={!academies.data}>
            Exportar CSV
          </button>
        }
      />

      <input
        type="search"
        className="search"
        placeholder="Buscar por academia, dono ou e-mail"
        aria-label="Buscar academias"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {academies.error ? (
        <LoadFailed error={academies.error} onRetry={academies.reload} />
      ) : !academies.data ? (
        <Loading />
      ) : academies.data.length === 0 ? (
        <p className="muted state">Nenhuma academia encontrada.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Academia</th>
                <th>Dono</th>
                <th>Plano</th>
                <th className="num">Alunos</th>
                <th className="num">Staff</th>
                <th className="num">Pendentes</th>
                <th>Criada em</th>
              </tr>
            </thead>
            <tbody>
              {academies.data.map(a => (
                <tr key={a.id} className="clickable" onClick={() => navigate(`/academias/${a.id}`)}>
                  <td>
                    <a
                      className="row-title"
                      href={`#/academias/${a.id}`}
                      onClick={e => e.stopPropagation()}
                    >
                      <AcademyLogo path={a.logo_path} name={a.name} size={32} />
                      {a.name}
                    </a>
                  </td>
                  <td>
                    {a.owner_name || '—'}
                    {a.owner_email && <div className="muted small hide-mobile">{a.owner_email}</div>}
                  </td>
                  <td>{planName(a.plan_tier)}</td>
                  <td className="num">{a.students}</td>
                  <td className="num">{a.staff}</td>
                  <td className="num">{a.pending > 0 ? <span className="badge badge-warning">{a.pending}</span> : 0}</td>
                  <td>{formatDate(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
