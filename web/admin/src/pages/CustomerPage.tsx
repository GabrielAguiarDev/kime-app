import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { api, type BillingPeriod, type Customer, type NoteKind, type Plan, type SubscriptionStatus } from '../api';
import { AcademyLogo } from '../components/AcademyLogo';
import { ActionDialog } from '../components/ActionDialog';
import { InvoiceTable } from '../components/InvoiceTable';
import { LoadFailed, Loading } from '../components/StateView';
import {
  NOTE_LABEL,
  PERIOD_LABEL,
  SUBSCRIPTION_LABEL,
  TICKET_LABEL,
  centsToInput,
  currentMonth,
  daySp,
  errorMessage,
  formatCents,
  formatDate,
  formatDateTime,
  parseCents,
  subscriptionLabel,
  subscriptionTone,
  today,
} from '../format';
import { useLoad } from '../useLoad';
import { whatsappLink } from './Customers';

export function CustomerPage() {
  const { id = '' } = useParams();
  const customer = useLoad(() => api.getCustomer(id), [id]);
  const plans = useLoad(() => api.listPlans(), []);
  const [newInvoice, setNewInvoice] = useState(false);

  if (customer.error) return <LoadFailed error={customer.error} onRetry={customer.reload} />;
  if (customer.loading && !customer.data) return <Loading />;
  if (!customer.data) return <p className="muted state">Cliente não encontrado.</p>;
  const c = customer.data;
  const s = c.subscription;

  return (
    <>
      <p className="breadcrumb">
        <Link to="/clientes">Clientes</Link> / {c.name}
      </p>
      <div className="page-title">
        <AcademyLogo path={c.logo_path} name={c.name} size={56} />
        <div>
          <h1>{c.name}</h1>
          <p className="muted">
            Cliente desde {formatDate(c.created_at)} · {c.students} aluno(s) ativo(s) ·{' '}
            <Link to={`/academias/${c.academy_id}`}>Ver membros</Link>
          </p>
          <p className="muted">
            Dono:{' '}
            {c.owner_id ? <Link to={`/usuarios/${c.owner_id}`}>{c.owner_name || c.owner_email}</Link> : '—'}
            {c.owner_email && <> · <a href={`mailto:${c.owner_email}`}>{c.owner_email}</a></>}
            {c.owner_whatsapp && (
              <>
                {' · '}
                <a href={whatsappLink(c.owner_whatsapp)} target="_blank" rel="noreferrer">
                  WhatsApp {c.owner_whatsapp}
                </a>
              </>
            )}
          </p>
        </div>
      </div>

      <section className="stats" aria-label="Assinatura">
        <div className="card stat">
          <span className={`badge badge-${subscriptionTone(s.status, s.trial_ends_at)} badge-large`}>
            {subscriptionLabel(s.status, s.trial_ends_at)}
          </span>
          <span className="muted">Situação</span>
        </div>
        <div className="card stat">
          <span className="stat-value">{formatCents(s.mrr_cents)}</span>
          <span className="muted">MRR</span>
        </div>
        <div className="card stat">
          <span className="stat-value">{s.cycle_cents == null ? '—' : formatCents(s.cycle_cents)}</span>
          <span className="muted">Valor por ciclo ({PERIOD_LABEL[s.billing_period].toLowerCase()})</span>
        </div>
      </section>

      <h2>Assinatura</h2>
      {plans.data ? (
        <SubscriptionForm key={c.academy_id} customer={c} plans={plans.data} onSaved={customer.reload} />
      ) : plans.error ? (
        <LoadFailed error={plans.error} onRetry={plans.reload} />
      ) : (
        <Loading />
      )}

      <div className="section-head">
        <h2>Faturas</h2>
        <button type="button" className="btn" onClick={() => setNewInvoice(true)}>
          Nova fatura
        </button>
      </div>
      <InvoiceTable invoices={c.invoices} onChanged={customer.reload} />

      <h2>Notas internas</h2>
      <NotesSection customer={c} onChanged={customer.reload} />

      <h2>Chamados de suporte</h2>
      {c.tickets.length === 0 ? (
        <p className="muted state">Nenhum chamado sobre esta academia.</p>
      ) : (
        <ul className="list card">
          {c.tickets.map(t => (
            <li key={t.id}>
              <Link to={`/suporte/${t.id}`} className="row-title">
                #{t.number} {t.subject}
              </Link>
              <span className="muted small">
                {TICKET_LABEL[t.status]} · {formatDateTime(t.last_message_at)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {newInvoice && (
        <NewInvoiceDialog customer={c} onDone={customer.reload} onClose={() => setNewInvoice(false)} />
      )}
    </>
  );
}

function SubscriptionForm({ customer, plans, onSaved }: { customer: Customer; plans: Plan[]; onSaved: () => void }) {
  const s = customer.subscription;
  const [plan, setPlan] = useState(customer.plan_code ?? '');
  const [period, setPeriod] = useState<BillingPeriod>(s.billing_period);
  const [price, setPrice] = useState(centsToInput(s.custom_price_cents));
  const [status, setStatus] = useState<SubscriptionStatus>(s.status);
  const [trialEnds, setTrialEnds] = useState(daySp(s.trial_ends_at));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const chosen = plans.find(p => p.code === plan);
  const planPrice = chosen
    ? period === 'annual'
      ? Math.round((chosen.monthly_price_cents * 12 * (100 - chosen.annual_discount_pct)) / 100)
      : chosen.monthly_price_cents
    : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const custom = parseCents(price);
    if (Number.isNaN(custom)) {
      setMessage({ ok: false, text: 'Preço negociado inválido. Use, por exemplo, 149,90.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await api.updateSubscription(customer.academy_id, {
        plan_code: plan || null,
        billing_period: period,
        custom_price_cents: custom,
        status,
        trial_ends_at: trialEnds ? `${trialEnds}T23:59:59-03:00` : null,
      });
      setMessage({ ok: true, text: 'Assinatura salva.' });
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
        <span>Plano</span>
        <select value={plan} onChange={e => setPlan(e.target.value)}>
          <option value="">Sem plano</option>
          {plans.map(p => (
            <option key={p.code} value={p.code}>
              {p.name}
              {p.is_active ? '' : ' (fora de venda)'}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Cobrança</span>
        <select value={period} onChange={e => setPeriod(e.target.value as BillingPeriod)}>
          {(Object.keys(PERIOD_LABEL) as BillingPeriod[]).map(p => (
            <option key={p} value={p}>
              {PERIOD_LABEL[p]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Preço negociado por ciclo (R$)</span>
        <input
          inputMode="decimal"
          placeholder={planPrice == null ? 'Sem plano' : `Do plano: ${centsToInput(planPrice)}`}
          value={price}
          onChange={e => setPrice(e.target.value)}
        />
        <small>Vazio = preço do plano.</small>
      </label>
      <label className="field">
        <span>Situação</span>
        <select value={status} onChange={e => setStatus(e.target.value as SubscriptionStatus)}>
          {(Object.keys(SUBSCRIPTION_LABEL) as SubscriptionStatus[]).map(st => (
            <option key={st} value={st}>
              {SUBSCRIPTION_LABEL[st]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Fim do teste</span>
        <input type="date" value={trialEnds} onChange={e => setTrialEnds(e.target.value)} />
      </label>
      <div className="form-footer">
        {message && (
          <p className={message.ok ? 'form-ok' : 'form-error'} role="status">
            {message.text}
          </p>
        )}
        <span className="muted small">Pagamento: {s.provider === 'manual' ? 'registro manual' : s.provider}</span>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar assinatura'}
        </button>
      </div>
    </form>
  );
}

function NotesSection({ customer, onChanged }: { customer: Customer; onChanged: () => void }) {
  const [kind, setKind] = useState<NoteKind>('note');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.addNote(customer.academy_id, kind, body.trim());
      setBody('');
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className="card form-stack" onSubmit={submit}>
        <div className="note-form-row">
          <select aria-label="Tipo" value={kind} onChange={e => setKind(e.target.value as NoteKind)}>
            {(Object.keys(NOTE_LABEL) as NoteKind[]).map(k => (
              <option key={k} value={k}>
                {NOTE_LABEL[k]}
              </option>
            ))}
          </select>
          <span className="muted small">Só a equipe do Kimi vê estas notas.</span>
        </div>
        <textarea
          aria-label="Nota"
          rows={3}
          maxLength={4000}
          placeholder="O que aconteceu? Ex.: ligou pedindo desconto no plano anual."
          value={body}
          onChange={e => setBody(e.target.value)}
        />
        {error && <p className="form-error">{error}</p>}
        <div className="form-footer">
          <button type="submit" className="btn btn-primary" disabled={busy || !body.trim()}>
            {busy ? 'Salvando…' : 'Adicionar nota'}
          </button>
        </div>
      </form>
      {customer.notes.length > 0 && (
        <ul className="timeline">
          {customer.notes.map(n => (
            <li key={n.id} className="card">
              <div className="timeline-head">
                <span className="badge">{NOTE_LABEL[n.kind]}</span>
                <span className="muted small">
                  {formatDateTime(n.created_at)}
                  {n.author_name && ` · ${n.author_name}`}
                </span>
                <button type="button" className="btn btn-small btn-danger" onClick={() => setRemoving(n.id)}>
                  Apagar
                </button>
              </div>
              <p className="pre">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
      {removing && (
        <ActionDialog
          title="Apagar esta nota?"
          confirmLabel="Apagar"
          danger
          onConfirm={async () => {
            await api.deleteNote(removing);
            onChanged();
          }}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}

function NewInvoiceDialog({ customer, onDone, onClose }: { customer: Customer; onDone: () => void; onClose: () => void }) {
  const [month, setMonth] = useState(currentMonth().slice(0, 7));
  const [amount, setAmount] = useState(centsToInput(customer.subscription.cycle_cents));
  const [due, setDue] = useState(today());
  const [description, setDescription] = useState('');
  const cents = parseCents(amount);
  return (
    <ActionDialog
      title={`Nova fatura · ${customer.name}`}
      confirmLabel="Criar fatura"
      disabled={!month || !due || cents == null || Number.isNaN(cents) || cents <= 0}
      onConfirm={async () => {
        await api.createInvoice(customer.academy_id, `${month}-01`, cents!, due, description.trim());
        onDone();
      }}
      onClose={onClose}
    >
      <div className="form-stack">
        <label className="field">
          <span>Mês de referência</span>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
        </label>
        <label className="field">
          <span>Valor (R$)</span>
          <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
        </label>
        <label className="field">
          <span>Vencimento</span>
          <input type="date" value={due} onChange={e => setDue(e.target.value)} />
        </label>
        <label className="field">
          <span>Descrição (opcional)</span>
          <input maxLength={200} value={description} onChange={e => setDescription(e.target.value)} />
        </label>
      </div>
      <p className="muted small">Só pode haver uma fatura ativa por mês para cada academia.</p>
    </ActionDialog>
  );
}
