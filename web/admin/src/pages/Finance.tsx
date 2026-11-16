import { useState } from 'react';
import { api } from '../api';
import { ActionDialog } from '../components/ActionDialog';
import { InvoiceTable } from '../components/InvoiceTable';
import { PageHeader } from '../components/PageHeader';
import { Segmented } from '../components/Segmented';
import { Stat } from '../components/Stat';
import { LoadFailed, Loading } from '../components/StateView';
import { csvMoney, downloadCsv } from '../csv';
import { INVOICE_LABEL, METHOD_LABEL, currentMonth, formatCents, formatCentsShort, formatMonthLong } from '../format';
import { useLoad } from '../useLoad';

type Filter = 'all' | 'open' | 'overdue' | 'paid' | 'void';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'open', label: 'Em aberto' },
  { value: 'overdue', label: 'Em atraso' },
  { value: 'paid', label: 'Pagas' },
  { value: 'void', label: 'Canceladas' },
];

export function Finance() {
  const [filter, setFilter] = useState<Filter>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [generating, setGenerating] = useState(false);
  const dash = useLoad(() => api.dashboard(), []);
  const invoices = useLoad(
    () => api.listInvoices(filter === 'all' ? null : filter, from ? `${from}-01` : null, to ? `${to}-01` : null),
    [filter, from, to],
  );
  const reload = () => {
    invoices.reload();
    dash.reload();
  };

  function exportCsv() {
    if (!invoices.data) return;
    downloadCsv('kimi-faturas.csv', invoices.data, [
      ['Número', i => i.number],
      ['Academia', i => i.academy_name],
      ['Referência', i => i.reference_month.slice(0, 7)],
      ['Descrição', i => i.description],
      ['Valor (R$)', i => csvMoney(i.amount_cents)],
      ['Vencimento', i => i.due_date],
      ['Situação', i => (i.is_overdue ? 'Em atraso' : INVOICE_LABEL[i.status])],
      ['Pago em', i => i.paid_on ?? ''],
      ['Forma', i => (i.payment_method ? METHOD_LABEL[i.payment_method] : '')],
    ]);
  }

  const total = invoices.data?.reduce((s, i) => s + (i.status === 'void' ? 0 : i.amount_cents), 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Financeiro"
        subtitle="Assinaturas das academias com o Kimi. Hoje os pagamentos são registrados à mão; um gateway entra depois."
        actions={
          <>
            <button type="button" className="btn" onClick={exportCsv} disabled={!invoices.data}>
              Exportar CSV
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setGenerating(true)}>
              Gerar faturas do mês
            </button>
          </>
        }
      />
      {dash.data && (
        <section className="stats" aria-label="Resumo financeiro">
          <Stat label="MRR" value={formatCentsShort(dash.data.mrr_cents)} hint={`${dash.data.paying} assinante(s) pagante(s)`} />
          <Stat label="Recebido no mês" value={formatCentsShort(dash.data.received_month_cents)} />
          <Stat label="Em aberto do mês" value={formatCentsShort(dash.data.open_month_cents)} />
          <Stat
            label="Em atraso"
            value={formatCentsShort(dash.data.overdue_cents)}
            hint={`${dash.data.overdue_count} fatura(s)`}
            tone={dash.data.overdue_count > 0 ? 'danger' : undefined}
          />
        </section>
      )}

      <div className="filters">
        <Segmented label="Situação" value={filter} options={FILTERS} onChange={setFilter} />
        <label className="field field-inline">
          <span>De</span>
          <input type="month" value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label className="field field-inline">
          <span>Até</span>
          <input type="month" value={to} onChange={e => setTo(e.target.value)} />
        </label>
      </div>

      {invoices.error ? (
        <LoadFailed error={invoices.error} onRetry={invoices.reload} />
      ) : !invoices.data ? (
        <Loading />
      ) : (
        <>
          <p className="muted small">
            {invoices.data.length} fatura(s) · {formatCents(total)} (sem as canceladas)
          </p>
          <InvoiceTable invoices={invoices.data} showAcademy onChanged={reload} />
        </>
      )}

      {generating && <GenerateDialog onDone={reload} onClose={() => setGenerating(false)} />}
    </>
  );
}

function GenerateDialog({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [month, setMonth] = useState(currentMonth().slice(0, 7));
  const [dueDay, setDueDay] = useState('10');
  const [result, setResult] = useState<number | null>(null);
  return (
    <ActionDialog
      title={result == null ? 'Gerar faturas do mês' : 'Faturas geradas'}
      confirmLabel={result == null ? 'Gerar faturas' : 'Fechar'}
      disabled={!month || !(Number(dueDay) >= 1 && Number(dueDay) <= 28)}
      keepOpen={result == null}
      onConfirm={async () => {
        if (result != null) return;
        const n = await api.generateInvoices(`${month}-01`, Number(dueDay));
        setResult(n);
        onDone();
      }}
      onClose={onClose}
    >
      {result == null ? (
        <>
          <p>
            Cria uma fatura para cada assinatura ativa ou em atraso que ainda não tem fatura no mês. Planos anuais são
            cobrados uma vez e cobrem 12 meses. Academias em teste ou canceladas ficam de fora. Se o dia de vencimento
            já passou, a fatura vence hoje.
          </p>
          <div className="form-stack">
            <label className="field">
              <span>Mês de referência</span>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
            </label>
            <label className="field">
              <span>Dia de vencimento (1 a 28)</span>
              <input type="number" min={1} max={28} value={dueDay} onChange={e => setDueDay(e.target.value)} />
            </label>
          </div>
        </>
      ) : (
        <p>
          {result === 0
            ? `Nenhuma fatura nova para ${formatMonthLong(`${month}-01`)}: todas as assinaturas pagantes já têm fatura.`
            : `${result} fatura(s) criada(s) para ${formatMonthLong(`${month}-01`)}.`}
        </p>
      )}
    </ActionDialog>
  );
}
