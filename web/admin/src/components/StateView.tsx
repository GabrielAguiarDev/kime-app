import { errorMessage } from '../format';

export function Loading() {
  return <p className="muted state">Carregando…</p>;
}

export function LoadFailed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="card state" role="alert">
      <p>{errorMessage(error)}</p>
      <button type="button" className="btn" onClick={onRetry}>
        Tentar de novo
      </button>
    </div>
  );
}
