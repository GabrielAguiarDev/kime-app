import { useState } from 'react';
import { api, type Plan, type PlanInput } from '../api';
import { ActionDialog } from '../components/ActionDialog';
import { PageHeader } from '../components/PageHeader';
import { LoadFailed, Loading } from '../components/StateView';
import { centsToInput, formatCents, parseCents } from '../format';
import { useLoad } from '../useLoad';

const annualCents = (p: Pick<Plan, 'monthly_price_cents' | 'annual_discount_pct'>) =>
  Math.round((p.monthly_price_cents * 12 * (100 - p.annual_discount_pct)) / 100);

export function Plans() {
  const plans = useLoad(() => api.listPlans(), []);
  const [editing, setEditing] = useState<Plan | 'new' | null>(null);

  return (
    <>
      <PageHeader
        title="Planos"
        subtitle="O que aparece no app ao criar uma academia. Planos fora de venda somem do app, mas as academias que já estão neles continuam."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            Novo plano
          </button>
        }
      />
      {plans.error ? (
        <LoadFailed error={plans.error} onRetry={plans.reload} />
      ) : !plans.data ? (
        <Loading />
      ) : (
        <div className="plan-grid">
          {plans.data.map(p => (
            <article key={p.id} className={p.is_active ? 'card plan' : 'card plan plan-off'}>
              <div className="plan-head">
                <h2>{p.name}</h2>
                {p.is_popular && <span className="badge badge-owner">Mais escolhido</span>}
                {!p.is_active && <span className="badge">Fora de venda</span>}
              </div>
              <p className="stat-value">{formatCents(p.monthly_price_cents)}<span className="muted small"> /mês</span></p>
              <p className="muted small">
                Anual: {formatCents(annualCents(p))} ({p.annual_discount_pct}% de desconto) · Teste de {p.trial_days} dia(s)
              </p>
              <p>{p.student_limit == null ? 'Alunos ilimitados' : `Até ${p.student_limit} alunos`}</p>
              <ul className="benefits">
                {p.benefits.map(b => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <div className="plan-foot">
                <span className="muted small">
                  Código <code>{p.code}</code> · {p.academies} academia(s)
                </span>
                <button type="button" className="btn btn-small" onClick={() => setEditing(p)}>
                  Editar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && (
        <PlanDialog
          plan={editing === 'new' ? null : editing}
          nextPosition={(plans.data?.length ?? 0)}
          onDone={plans.reload}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function PlanDialog({ plan, nextPosition, onDone, onClose }: { plan: Plan | null; nextPosition: number; onDone: () => void; onClose: () => void }) {
  const [code, setCode] = useState(plan?.code ?? '');
  const [name, setName] = useState(plan?.name ?? '');
  const [price, setPrice] = useState(plan ? centsToInput(plan.monthly_price_cents) : '');
  const [discount, setDiscount] = useState(String(plan?.annual_discount_pct ?? 20));
  const [limit, setLimit] = useState(plan?.student_limit == null ? '' : String(plan.student_limit));
  const [benefits, setBenefits] = useState(plan?.benefits.join('\n') ?? '');
  const [trial, setTrial] = useState(String(plan?.trial_days ?? 14));
  const [popular, setPopular] = useState(plan?.is_popular ?? false);
  const [active, setActive] = useState(plan?.is_active ?? true);
  const [position, setPosition] = useState(String(plan?.sort_position ?? nextPosition));

  const cents = parseCents(price);
  const valid =
    /^[a-z][a-z0-9_]{1,29}$/.test(code) &&
    name.trim().length >= 2 &&
    cents != null &&
    !Number.isNaN(cents) &&
    discount.trim() !== '' &&
    Number.isInteger(Number(discount)) &&
    Number(discount) >= 0 &&
    Number(discount) <= 90 &&
    (limit === '' || (Number.isInteger(Number(limit)) && Number(limit) > 0)) &&
    trial.trim() !== '' &&
    Number.isInteger(Number(trial)) &&
    Number(trial) >= 0 &&
    Number(trial) <= 90 &&
    Number.isInteger(Number(position || 0));

  const input: PlanInput = {
    code,
    name: name.trim(),
    monthly_price_cents: cents ?? 0,
    annual_discount_pct: Number(discount),
    student_limit: limit === '' ? null : Number(limit),
    benefits: benefits.split('\n').map(b => b.trim()).filter(Boolean).slice(0, 12),
    trial_days: Number(trial),
    is_popular: popular,
    is_active: active,
    sort_position: Number(position) || 0,
  };

  return (
    <ActionDialog
      title={plan ? `Editar ${plan.name}` : 'Novo plano'}
      confirmLabel="Salvar plano"
      disabled={!valid}
      onConfirm={async () => {
        await api.savePlan(plan?.id ?? null, input);
        onDone();
      }}
      onClose={onClose}
    >
      <div className="form-grid form-grid-tight">
        <label className="field">
          <span>Código</span>
          <input value={code} disabled={!!plan} maxLength={30} onChange={e => setCode(e.target.value.toLowerCase())} />
          <small>{plan ? 'Não muda depois de criado.' : 'Letras minúsculas, números e _. Não muda depois.'}</small>
        </label>
        <label className="field">
          <span>Nome</span>
          <input value={name} maxLength={40} onChange={e => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Preço mensal (R$)</span>
          <input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} />
        </label>
        <label className="field">
          <span>Desconto anual (%)</span>
          <input type="number" min={0} max={90} value={discount} onChange={e => setDiscount(e.target.value)} />
        </label>
        <label className="field">
          <span>Limite de alunos</span>
          <input type="number" min={1} placeholder="Ilimitado" value={limit} onChange={e => setLimit(e.target.value)} />
        </label>
        <label className="field">
          <span>Dias de teste</span>
          <input type="number" min={0} max={90} value={trial} onChange={e => setTrial(e.target.value)} />
        </label>
        <label className="field">
          <span>Ordem</span>
          <input type="number" min={0} value={position} onChange={e => setPosition(e.target.value)} />
        </label>
        <label className="field field-wide">
          <span>Benefícios (um por linha, até 12)</span>
          <textarea rows={5} value={benefits} onChange={e => setBenefits(e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={popular} onChange={e => setPopular(e.target.checked)} />
          Destacar como "Mais escolhido" (tira o destaque dos outros)
        </label>
        <label className="check">
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
          À venda no app
        </label>
      </div>
      <p className="muted small">O limite de alunos aparece no app, mas ainda não bloqueia nada.</p>
    </ActionDialog>
  );
}
