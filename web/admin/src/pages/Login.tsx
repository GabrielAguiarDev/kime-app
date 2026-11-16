import { useState, type FormEvent } from 'react';
import { errorMessage } from '../format';
import { supabase } from '../supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      setError(errorMessage(authError));
      setBusy(false);
    }
  }

  return (
    <div className="center-page">
      <form className="card auth-card" onSubmit={submit}>
        <div className="brand brand-large">
          <img src="/kimi.png" alt="" />
          <span className="brand-name">KIMI</span>
        </div>
        <p className="muted">Área exclusiva da equipe do Kimi. Entre com o e-mail e a senha da sua conta.</p>
        <label className="field">
          <span>E-mail</span>
          <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Senha</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
