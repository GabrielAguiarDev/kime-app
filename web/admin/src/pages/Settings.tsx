import { SignOut } from '@phosphor-icons/react';
import { useState, type FormEvent } from 'react';
import { PageHeader } from '../components/PageHeader';
import { useAccount } from '../components/Layout';
import { errorMessage } from '../format';
import { useSession } from '../session';
import { supabase } from '../supabase';

type Message = { ok: boolean; text: string } | null;

export function Settings() {
  const session = useSession();
  const user = session.kind === 'admin' ? session.session.user : null;
  return (
    <>
      <PageHeader title="Configurações" subtitle="Sua conta de administrador do Kimi" />
      <div className="settings">
        {user && <ProfileSection userId={user.id} />}
        {user?.email && <PasswordSection email={user.email} />}
        <section className="card settings-section">
          <div>
            <h2 className="card-title">Sessão</h2>
            <p className="muted">Sai do admin neste navegador.</p>
          </div>
          <button type="button" className="btn btn-danger" onClick={() => void supabase.auth.signOut()}>
            <SignOut size={16} weight="bold" aria-hidden="true" /> Sair
          </button>
        </section>
      </div>
    </>
  );
}

function ProfileSection({ userId }: { userId: string }) {
  const { name, setName } = useAccount();
  const [value, setValue] = useState(name ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const trimmed = value.trim();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.from('profiles').update({ full_name: trimmed }).eq('id', userId);
    setBusy(false);
    if (error) {
      setMessage({ ok: false, text: errorMessage(error) });
      return;
    }
    setName(trimmed);
    setValue(trimmed);
    setMessage({ ok: true, text: 'Nome salvo. Ele também aparece no app.' });
  }

  return (
    <form className="card settings-section" onSubmit={submit}>
      <div>
        <h2 className="card-title">Perfil</h2>
        <p className="muted">É o mesmo nome do seu perfil no app.</p>
      </div>
      <div className="form-stack settings-fields">
        <label className="field">
          <span>Nome</span>
          <input
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            value={value}
            onChange={e => {
              setValue(e.target.value);
              setMessage(null);
            }}
          />
        </label>
        {message && <p className={message.ok ? 'form-ok' : 'form-error'} role="status">{message.text}</p>}
        <div className="form-footer">
          <button type="submit" className="btn btn-primary" disabled={busy || trimmed.length < 2 || trimmed === (name ?? '')}>
            {busy ? 'Salvando…' : 'Salvar nome'}
          </button>
        </div>
      </div>
    </form>
  );
}

function PasswordSection({ email }: { email: string }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const mismatch = confirm.length > 0 && next !== confirm;
  const valid = current.length > 0 && next.length >= 8 && next === confirm && next !== current;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      // Confirms the current password first: an unattended open session is not enough to change it.
      const check = await supabase.auth.signInWithPassword({ email, password: current });
      if (check.error) throw new Error('Senha atual incorreta.');
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      setCurrent('');
      setNext('');
      setConfirm('');
      setMessage({ ok: true, text: 'Senha alterada. Use a nova senha no próximo login, aqui e no app.' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error && err.message === 'Senha atual incorreta.' ? err.message : passwordError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card settings-section" onSubmit={submit}>
      <div>
        <h2 className="card-title">Conta</h2>
        <p className="muted">
          E-mail de acesso: <strong className="settings-email">{email}</strong>
        </p>
      </div>
      <div className="form-stack settings-fields">
        <label className="field">
          <span>Senha atual</span>
          <input type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} />
        </label>
        <label className="field">
          <span>Nova senha (mínimo de 8 caracteres)</span>
          <input type="password" autoComplete="new-password" minLength={8} required value={next} onChange={e => setNext(e.target.value)} />
        </label>
        <label className="field">
          <span>Confirmar nova senha</span>
          <input type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} />
          {mismatch && <small className="text-danger">As senhas não são iguais.</small>}
        </label>
        {message && <p className={message.ok ? 'form-ok' : 'form-error'} role="status">{message.text}</p>}
        <div className="form-footer">
          <button type="submit" className="btn btn-primary" disabled={busy || !valid}>
            {busy ? 'Alterando…' : 'Alterar senha'}
          </button>
        </div>
      </div>
    </form>
  );
}

function passwordError(e: unknown): string {
  const code = (e as { code?: string } | null)?.code;
  if (code === 'weak_password') return 'Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.';
  if (code === 'same_password') return 'A nova senha precisa ser diferente da atual.';
  return errorMessage(e);
}
