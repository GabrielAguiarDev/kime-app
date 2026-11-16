import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useDeferredValue, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api';
import { PageHeader } from '../components/PageHeader';
import { LoadFailed, Loading } from '../components/StateView';
import { downloadCsv } from '../csv';
import { formatDate, formatDateTime } from '../format';
import { useLoad } from '../useLoad';

const PAGE = 50;

export function Users() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const query = useDeferredValue(search.trim());
  const users = useLoad(() => api.listUsers(query, PAGE, page * PAGE), [query, page]);
  const total = users.data?.[0]?.total_count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE), page + 1);

  const [exporting, setExporting] = useState(false);
  async function exportCsv() {
    setExporting(true);
    try {
      const all = await api.listUsers(query, 5000, 0);
      downloadCsv('kimi-usuarios.csv', all, [
        ['Nome', u => u.full_name],
        ['E-mail', u => u.email ?? ''],
        ['Academias ativas', u => u.academies],
        ['Cadastro', u => u.created_at.slice(0, 10)],
        ['Último acesso', u => u.last_sign_in_at?.slice(0, 16).replace('T', ' ') ?? ''],
      ]);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle="Todas as contas do app (as contas anônimas da TV ficam de fora)"
        actions={
          <button type="button" className="btn" onClick={() => void exportCsv()} disabled={exporting}>
            {exporting ? 'Exportando…' : 'Exportar CSV'}
          </button>
        }
      />
      <input
        type="search"
        className="search"
        placeholder="Buscar por nome ou e-mail"
        aria-label="Buscar usuários"
        value={search}
        onChange={e => {
          setSearch(e.target.value);
          setPage(0);
        }}
      />
      {users.error ? (
        <LoadFailed error={users.error} onRetry={users.reload} />
      ) : !users.data ? (
        <Loading />
      ) : users.data.length === 0 && page === 0 ? (
        <p className="muted state">Nenhum usuário encontrado.</p>
      ) : (
        <>
          <p className="list-meta muted small">
            {total} {total === 1 ? 'usuário' : 'usuários'}
            {pages > 1 && ` · página ${page + 1} de ${pages}`}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th className="num">Academias</th>
                  <th>Cadastro</th>
                  <th>Último acesso</th>
                </tr>
              </thead>
              <tbody>
                {users.data.map(u => (
                  <tr key={u.id} className="clickable" onClick={() => navigate(`/usuarios/${u.id}`)}>
                    <td>
                      <a className="row-title" href={`#/usuarios/${u.id}`} onClick={e => e.stopPropagation()}>
                        {u.full_name || 'Sem nome'}
                      </a>
                    </td>
                    <td>{u.email ?? '—'}</td>
                    <td className="num">{u.academies}</td>
                    <td>{formatDate(u.created_at)}</td>
                    <td>{formatDateTime(u.last_sign_in_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <nav className="pager" aria-label="Páginas">
              <button type="button" className="btn btn-small" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <CaretLeft size={14} weight="bold" aria-hidden="true" /> Anterior
              </button>
              <button type="button" className="btn btn-small" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>
                Próxima <CaretRight size={14} weight="bold" aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}
    </>
  );
}
