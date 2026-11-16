import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { api, type Sex, type UserDetail } from '../api';
import { LoadFailed, Loading } from '../components/StateView';
import { ROLE_LABEL, SEX_LABEL, STATUS_LABEL, errorMessage, formatDate, formatDateTime } from '../format';
import { useLoad } from '../useLoad';

export function UserPage() {
  const { id = '' } = useParams();
  const user = useLoad(() => api.getUser(id), [id]);

  if (user.error) return <LoadFailed error={user.error} onRetry={user.reload} />;
  if (user.loading && !user.data) return <Loading />;
  if (!user.data) return <p className="muted state">Usuário não encontrado.</p>;
  const u = user.data;

  return (
    <>
      <p className="breadcrumb">
        <Link to="/usuarios">Usuários</Link> / {u.full_name || 'Sem nome'}
      </p>
      <h1>{u.full_name || 'Sem nome'}</h1>
      <p className="muted">
        {u.email ?? 'Sem e-mail'} · Cadastro em {formatDate(u.created_at)} · Último acesso {formatDateTime(u.last_sign_in_at)}
        {u.timezone && ` · Fuso ${u.timezone}`}
      </p>

      <ProfileForm key={u.id} user={u} onSaved={user.reload} />

      <h2>Academias</h2>
      {u.memberships.length === 0 ? (
        <p className="muted state">Não participa de nenhuma academia.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Academia</th>
                <th>Papel</th>
                <th>Situação</th>
                <th>Desde</th>
              </tr>
            </thead>
            <tbody>
              {u.memberships.map(m => (
                <tr key={m.membership_id}>
                  <td>
                    <Link to={`/academias/${m.academy_id}`} className="row-title">
                      {m.academy_name}
                    </Link>
                  </td>
                  <td>
                    <span className={`badge badge-${m.role}`}>{ROLE_LABEL[m.role]}</span>
                    {m.is_competitor && <span className="badge badge-competitor">Competidor</span>}
                  </td>
                  <td>
                    <span className={`badge badge-${m.status}`}>{STATUS_LABEL[m.status]}</span>
                  </td>
                  <td>{formatDate(m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">Papel, modalidades e remoção são alterados na página da academia.</p>
    </>
  );
}

const toNumber = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
const toText = (v: number | null) => (v == null ? '' : String(v));

function ProfileForm({ user, onSaved }: { user: UserDetail; onSaved: () => void }) {
  const [fullName, setFullName] = useState(user.full_name);
  const [birthDate, setBirthDate] = useState(user.birth_date ?? '');
  const [sex, setSex] = useState<Sex | ''>(user.sex ?? '');
  const [height, setHeight] = useState(toText(user.height_cm));
  const [weight, setWeight] = useState(toText(user.weight_kg));
  const [reach, setReach] = useState(toText(user.reach_cm));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await api.updateProfile(user.id, {
        full_name: fullName.trim(),
        birth_date: birthDate || null,
        sex: sex || null,
        height_cm: toNumber(height),
        weight_kg: toNumber(weight),
        reach_cm: toNumber(reach),
      });
      setFullName(fullName.trim());
      setMessage({ ok: true, text: 'Perfil salvo.' });
      onSaved();
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form-grid" onSubmit={submit}>
      <label className="field field-wide">
        <span>Nome</span>
        <input required minLength={2} maxLength={120} value={fullName} onChange={e => setFullName(e.target.value)} />
      </label>
      <label className="field">
        <span>Nascimento</span>
        <input type="date" min="1900-01-01" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
      </label>
      <label className="field">
        <span>Sexo</span>
        <select value={sex} onChange={e => setSex(e.target.value as Sex | '')}>
          <option value="">Não informado</option>
          {(Object.keys(SEX_LABEL) as Sex[]).map(s => (
            <option key={s} value={s}>
              {SEX_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Altura (cm)</span>
        <input type="number" min={1} max={299} step={0.1} value={height} onChange={e => setHeight(e.target.value)} />
      </label>
      <label className="field">
        <span>Peso (kg)</span>
        <input type="number" min={1} max={399} step={0.01} value={weight} onChange={e => setWeight(e.target.value)} />
        <small>A próxima pesagem registrada no app substitui este valor.</small>
      </label>
      <label className="field">
        <span>Envergadura (cm)</span>
        <input type="number" min={1} max={299} step={0.1} value={reach} onChange={e => setReach(e.target.value)} />
      </label>
      <div className="form-footer">
        {message && (
          <p className={message.ok ? 'form-ok' : 'form-error'} role="status">
            {message.text}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar perfil'}
        </button>
      </div>
    </form>
  );
}
