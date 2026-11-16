import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { api, type Academy, type Member, type MemberModality, type Modality, type Status } from '../api';
import { AcademyLogo } from '../components/AcademyLogo';
import { ActionDialog } from '../components/ActionDialog';
import { ModalityChecklist } from '../components/ModalityChecklist';
import { LoadFailed, Loading } from '../components/StateView';
import { ROLE_LABEL, STATUS_LABEL, errorMessage, formatDate } from '../format';
import { useLoad } from '../useLoad';

type Dialog =
  | { kind: 'approve' | 'reject' | 'remove' | 'modalities' | 'toStudent' | 'toInstructor'; member: Member }
  | { kind: 'competitor'; member: Member; modality: MemberModality };

const STATUS_ORDER: Status[] = ['pending', 'active', 'rejected'];
const SECTION_TITLE: Record<Status, string> = {
  pending: 'Pedidos pendentes',
  active: 'Membros ativos',
  rejected: 'Pedidos recusados',
};

export function AcademyPage() {
  const { id = '' } = useParams();
  const academy = useLoad(() => api.getAcademy(id), [id]);
  const members = useLoad(() => api.members(id), [id]);
  const modalities = useLoad(() => api.modalities(id), [id]);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  if (academy.error) return <LoadFailed error={academy.error} onRetry={academy.reload} />;
  if (academy.loading && !academy.data) return <Loading />;
  if (!academy.data) return <p className="muted state">Academia não encontrada.</p>;

  const a = academy.data;
  const afterChange = () => {
    members.reload();
    academy.reload();
  };

  return (
    <>
      <p className="breadcrumb">
        <Link to="/academias">Academias</Link> / {a.name}
      </p>
      <div className="page-title">
        <AcademyLogo path={a.logo_path} name={a.name} size={56} />
        <div>
          <h1>{a.name}</h1>
          <p className="muted">
            Criada em {formatDate(a.created_at)} · Fuso {a.timezone}
            {a.owner_id && (
              <>
                {' · Dono: '}
                <Link to={`/usuarios/${a.owner_id}`}>{a.owner_name || a.owner_email}</Link>
              </>
            )}
          </p>
        </div>
      </div>

      <AcademyForm key={a.id} academy={a} onSaved={academy.reload} />

      <h2>Membros</h2>
      {members.error ? (
        <LoadFailed error={members.error} onRetry={members.reload} />
      ) : !members.data ? (
        <Loading />
      ) : members.data.length === 0 ? (
        <p className="muted state">Nenhum membro.</p>
      ) : (
        STATUS_ORDER.map(status => {
          const list = members.data!.filter(m => m.status === status);
          if (list.length === 0) return null;
          return (
            <section key={status}>
              <h3>
                {SECTION_TITLE[status]} <span className="muted">({list.length})</span>
              </h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Papel</th>
                      <th>Modalidades</th>
                      <th>{status === 'pending' ? 'Pedido em' : 'Desde'}</th>
                      <th className="actions-col">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map(m => (
                      <MemberRow key={m.membership_id} member={m} onAction={setDialog} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}

      {dialog && (
        <MemberDialog
          dialog={dialog}
          modalities={modalities.data}
          modalitiesError={modalities.error}
          onDone={afterChange}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

function AcademyForm({ academy, onSaved }: { academy: Academy; onSaved: () => void }) {
  const [name, setName] = useState(academy.name);
  const [days, setDays] = useState(String(academy.inactive_after_days));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty =
    name !== academy.name || days !== String(academy.inactive_after_days);

  useEffect(() => {
    if (dirty) setMessage(null);
  }, [dirty]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      // The plan changes only in the customer's subscription.
      await api.updateAcademy(academy.id, name.trim(), Number(days));
      setName(name.trim());
      setMessage({ ok: true, text: 'Academia salva.' });
      onSaved();
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form-grid" onSubmit={submit}>
      <label className="field">
        <span>Nome</span>
        <input required minLength={2} maxLength={80} value={name} onChange={e => setName(e.target.value)} />
      </label>
      <div className="field">
        <span>Plano</span>
        <Link to={`/clientes/${academy.id}`} className="field-link">
          {academy.plan_tier ?? 'Sem plano'} · alterar na assinatura do cliente
        </Link>
      </div>
      <label className="field">
        <span>Dias sem aula para "sumido"</span>
        <input type="number" required min={7} max={90} value={days} onChange={e => setDays(e.target.value)} />
      </label>
      <div className="form-footer">
        {message && (
          <p className={message.ok ? 'form-ok' : 'form-error'} role="status">
            {message.text}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy || !dirty}>
          {busy ? 'Salvando…' : 'Salvar academia'}
        </button>
      </div>
    </form>
  );
}

function MemberRow({ member: m, onAction }: { member: Member; onAction: (d: Dialog) => void }) {
  const isActiveStudent = m.status === 'active' && m.role === 'student';
  const canChange = m.role !== 'owner';
  return (
    <tr>
      <td>
        <Link to={`/usuarios/${m.user_id}`} className="row-title">
          {m.full_name || 'Sem nome'}
        </Link>
        {m.email && <div className="muted small hide-mobile">{m.email}</div>}
      </td>
      <td>
        <span className={`badge badge-${m.role}`}>{ROLE_LABEL[m.role]}</span>
        {m.status !== 'active' && <span className={`badge badge-${m.status}`}>{STATUS_LABEL[m.status]}</span>}
      </td>
      <td>
        {m.modalities.length === 0 ? (
          <span className="muted">—</span>
        ) : (
          <div className="chips">
            {m.modalities.map(mod => (
              <button
                key={mod.enrollment_id}
                type="button"
                className={mod.is_competitor ? 'chip chip-on' : 'chip'}
                title={mod.is_competitor ? 'Compete nesta modalidade. Clique para mudar.' : 'Clique para tornar competidor.'}
                disabled={!isActiveStudent}
                onClick={() => onAction({ kind: 'competitor', member: m, modality: mod })}
              >
                {mod.name}
                {mod.is_competitor && ' · Competidor'}
              </button>
            ))}
          </div>
        )}
      </td>
      <td>{formatDate(m.status === 'pending' ? m.created_at : (m.decided_at ?? m.created_at))}</td>
      <td className="actions-col">
        <div className="row-actions">
          {m.status === 'pending' && (
            <>
              <button type="button" className="btn btn-small btn-primary" onClick={() => onAction({ kind: 'approve', member: m })}>
                Aprovar
              </button>
              <button type="button" className="btn btn-small" onClick={() => onAction({ kind: 'reject', member: m })}>
                Recusar
              </button>
            </>
          )}
          {isActiveStudent && (
            <button type="button" className="btn btn-small" onClick={() => onAction({ kind: 'modalities', member: m })}>
              Modalidades
            </button>
          )}
          {m.status === 'active' && canChange && (
            <button
              type="button"
              className="btn btn-small"
              onClick={() => onAction({ kind: m.role === 'student' ? 'toInstructor' : 'toStudent', member: m })}
            >
              {m.role === 'student' ? 'Tornar professor' : 'Tornar aluno'}
            </button>
          )}
          {canChange && m.status !== 'pending' && (
            <button type="button" className="btn btn-small btn-danger" onClick={() => onAction({ kind: 'remove', member: m })}>
              Remover
            </button>
          )}
          {!canChange && <span className="muted small">Dono não muda pelo admin</span>}
        </div>
      </td>
    </tr>
  );
}

function MemberDialog({
  dialog,
  modalities,
  modalitiesError,
  onDone,
  onClose,
}: {
  dialog: Dialog;
  modalities: Modality[] | null;
  modalitiesError: unknown;
  onDone: () => void;
  onClose: () => void;
}) {
  const m = dialog.member;
  const name = m.full_name || m.email || 'este membro';
  const [selected, setSelected] = useState<string[]>(m.modalities.map(x => x.modality_id));
  const modalitiesReady = modalities !== null;
  const checklist = modalitiesError ? (
    <p className="form-error">Não foi possível carregar as modalidades: {errorMessage(modalitiesError)}</p>
  ) : !modalities ? (
    <Loading />
  ) : (
    <ModalityChecklist modalities={modalities} selected={selected} onChange={setSelected} />
  );
  const run = (action: () => Promise<void>) => async () => {
    await action();
    onDone();
  };

  switch (dialog.kind) {
    case 'approve': {
      const needsModalities = m.role === 'student';
      return (
        <ActionDialog
          title={`Aprovar ${name}?`}
          confirmLabel="Aprovar"
          disabled={needsModalities && (!modalitiesReady || selected.length === 0)}
          onConfirm={run(() => api.decide(m.membership_id, true, needsModalities ? selected : null))}
          onClose={onClose}
        >
          <p>
            Entra como <strong>{ROLE_LABEL[m.role].toLowerCase()}</strong> na academia.
          </p>
          {needsModalities && checklist}
        </ActionDialog>
      );
    }
    case 'reject':
      return (
        <ActionDialog
          title={`Recusar o pedido de ${name}?`}
          confirmLabel="Recusar pedido"
          danger
          onConfirm={run(() => api.decide(m.membership_id, false, null))}
          onClose={onClose}
        />
      );
    case 'remove':
      return (
        <ActionDialog
          title={`Remover ${name} da academia?`}
          confirmLabel="Remover"
          danger
          onConfirm={run(() => api.removeMembership(m.membership_id))}
          onClose={onClose}
        >
          <p>O vínculo é apagado, como quando o dono remove alguém pelo app. Esta ação não pode ser desfeita.</p>
        </ActionDialog>
      );
    case 'modalities':
      return (
        <ActionDialog
          title={`Modalidades de ${name}`}
          confirmLabel="Salvar modalidades"
          disabled={!modalitiesReady || selected.length === 0}
          onConfirm={run(() => api.setModalities(m.membership_id, selected))}
          onClose={onClose}
        >
          {checklist}
        </ActionDialog>
      );
    case 'toStudent':
      return (
        <ActionDialog
          title={`Tornar ${name} aluno?`}
          confirmLabel="Tornar aluno"
          disabled={!modalitiesReady || selected.length === 0}
          onConfirm={run(() => api.setRole(m.membership_id, 'student', selected))}
          onClose={onClose}
        >
          <p>Deixa de dar aulas: sai das modalidades que ensina e dos horários em que é o professor responsável.</p>
          {checklist}
        </ActionDialog>
      );
    case 'toInstructor':
      return (
        <ActionDialog
          title={`Tornar ${name} professor?`}
          confirmLabel="Tornar professor"
          onConfirm={run(() => api.setRole(m.membership_id, 'instructor', null))}
          onClose={onClose}
        >
          <p>
            Os vínculos de aluno com as modalidades são encerrados (aulas e faixas continuam no histórico) e as
            inscrições em campeonatos futuros são removidas.
          </p>
        </ActionDialog>
      );
    case 'competitor': {
      const next = !dialog.modality.is_competitor;
      return (
        <ActionDialog
          title={next ? `Tornar ${name} competidor em ${dialog.modality.name}?` : `Tirar ${name} dos competidores de ${dialog.modality.name}?`}
          confirmLabel={next ? 'Tornar competidor' : 'Tirar dos competidores'}
          danger={!next}
          onConfirm={run(() => api.setCompetitor(dialog.modality.enrollment_id, next))}
          onClose={onClose}
        >
          <p>
            {next
              ? 'Pelo admin não há convite: a pessoa passa a competir na hora.'
              : 'As inscrições em campeonatos futuros desta modalidade são removidas; as passadas ficam no histórico.'}
          </p>
        </ActionDialog>
      );
    }
  }
}
