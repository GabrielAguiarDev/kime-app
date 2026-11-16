import { useState } from 'react';
import { api, type Audience, type PlatformAnnouncement } from '../api';
import { ActionDialog } from '../components/ActionDialog';
import { PageHeader } from '../components/PageHeader';
import { LoadFailed, Loading } from '../components/StateView';
import { AUDIENCE_LABEL, formatDateTime, formatDay, today } from '../format';
import { useLoad } from '../useLoad';

export function Announcements() {
  const list = useLoad(() => api.listAnnouncements(), []);
  const [editing, setEditing] = useState<PlatformAnnouncement | 'new' | null>(null);
  const [removing, setRemoving] = useState<PlatformAnnouncement | null>(null);

  return (
    <>
      <PageHeader
        title="Avisos"
        subtitle="Comunicados do Kimi que aparecem na Início do app. Cada pessoa pode dispensar o aviso."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            Novo aviso
          </button>
        }
      />
      {list.error ? (
        <LoadFailed error={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : list.data.length === 0 ? (
        <p className="muted state">Nenhum aviso publicado.</p>
      ) : (
        <ul className="timeline">
          {list.data.map(a => (
            <li key={a.id} className="card">
              <div className="timeline-head">
                <span className={`badge ${a.is_live ? 'badge-active' : ''}`}>{a.is_live ? 'No ar' : 'Encerrado'}</span>
                <span className="badge">{AUDIENCE_LABEL[a.audience]}</span>
                <span className="muted small">
                  Publicado {formatDateTime(a.created_at)}
                  {a.ends_on && ` · até ${formatDay(a.ends_on)}`} · dispensado por {a.dismissals}
                </span>
                <span className="row-actions">
                  <button type="button" className="btn btn-small" onClick={() => setEditing(a)}>
                    Editar
                  </button>
                  <button type="button" className="btn btn-small btn-danger" onClick={() => setRemoving(a)}>
                    Apagar
                  </button>
                </span>
              </div>
              <h2 className="card-title">{a.title}</h2>
              <p className="pre">{a.body}</p>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <AnnouncementDialog item={editing === 'new' ? null : editing} onDone={list.reload} onClose={() => setEditing(null)} />
      )}
      {removing && (
        <ActionDialog
          title={`Apagar "${removing.title}"?`}
          confirmLabel="Apagar aviso"
          danger
          onConfirm={async () => {
            await api.deleteAnnouncement(removing.id);
            list.reload();
          }}
          onClose={() => setRemoving(null)}
        >
          <p>O aviso some do app na próxima atualização.</p>
        </ActionDialog>
      )}
    </>
  );
}

function AnnouncementDialog({ item, onDone, onClose }: { item: PlatformAnnouncement | null; onDone: () => void; onClose: () => void }) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [body, setBody] = useState(item?.body ?? '');
  const [audience, setAudience] = useState<Audience>(item?.audience ?? 'staff');
  const [endsOn, setEndsOn] = useState(item?.ends_on ?? '');
  return (
    <ActionDialog
      title={item ? 'Editar aviso' : 'Novo aviso'}
      confirmLabel={item ? 'Salvar aviso' : 'Publicar aviso'}
      disabled={title.trim().length < 3 || !body.trim()}
      onConfirm={async () => {
        await api.saveAnnouncement(item?.id ?? null, title.trim(), body.trim(), audience, endsOn || null);
        onDone();
      }}
      onClose={onClose}
    >
      <div className="form-stack">
        <label className="field">
          <span>Título</span>
          <input maxLength={80} value={title} onChange={e => setTitle(e.target.value)} />
        </label>
        <label className="field">
          <span>Mensagem</span>
          <textarea rows={5} maxLength={2000} value={body} onChange={e => setBody(e.target.value)} />
        </label>
        <label className="field">
          <span>Quem vê</span>
          <select value={audience} onChange={e => setAudience(e.target.value as Audience)}>
            {(Object.keys(AUDIENCE_LABEL) as Audience[]).map(a => (
              <option key={a} value={a}>
                {AUDIENCE_LABEL[a]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Último dia no ar (opcional)</span>
          <input type="date" min={today()} value={endsOn} onChange={e => setEndsOn(e.target.value)} />
        </label>
      </div>
    </ActionDialog>
  );
}
