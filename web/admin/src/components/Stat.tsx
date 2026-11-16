import type { ReactNode } from 'react';
import { Link } from 'react-router';

interface Props {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'danger' | 'warning';
  to?: string;
}

/** A KPI tile: big number, label and an optional hint line. */
export function Stat({ label, value, hint, tone, to }: Props) {
  const body = (
    <>
      <span className={tone ? `stat-value text-${tone}` : 'stat-value'}>{value}</span>
      <span className="muted">{label}</span>
      {hint && <span className="muted small">{hint}</span>}
    </>
  );
  return to ? (
    <Link to={to} className="card stat stat-link">
      {body}
    </Link>
  ) : (
    <div className="card stat">{body}</div>
  );
}
