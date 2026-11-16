import { errorMessage } from '../format';
import { supabase } from '../supabase';

export function NoAccess({ email, error }: { email: string | undefined; error?: unknown }) {
  return (
    <div className="center-page">
      <div className="card auth-card" role="alert">
        <h1>{error ? 'Não foi possível verificar o acesso' : 'Sem acesso'}</h1>
        <p className="muted">
          {error ? errorMessage(error) : `A conta ${email ?? ''} não está na lista de administradores do Kimi.`}
        </p>
        <button type="button" className="btn btn-block" onClick={() => void supabase.auth.signOut()}>
          Sair e entrar com outra conta
        </button>
      </div>
    </div>
  );
}
