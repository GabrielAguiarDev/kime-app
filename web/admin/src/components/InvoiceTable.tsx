import { useState } from 'react';
import { Link } from 'react-router';
import { api, type InvoiceStatus, type PaymentMethod } from '../api';
import { INVOICE_LABEL, METHOD_LABEL, formatCents, formatDay, formatMonthLong, today } from '../format';
import { ActionDialog } from './ActionDialog';

export interface InvoiceItem {
  id: string;
  number: number;
  academy_id?: string | null;
  academy_name?: string;
  reference_month: string;
  description: string;
  amount_cents: number;
  due_date: string;
  status: InvoiceStatus;
  paid_on: string | null;
  payment_method: PaymentMethod | null;
}

const isOverdue = (i: InvoiceItem) => i.status === 'open' && i.due_date < today();

/** Invoices with their actions: mark paid, undo the payment, cancel. */
export function InvoiceTable({ invoices, showAcademy, onChanged }: { invoices: InvoiceItem[]; showAcademy?: boolean; onChanged: () => void }) {
  const [dialog, setDialog] = useState<{ kind: 'pay' | 'undo' | 'void'; invoice: InvoiceItem } | null>(null);
  if (invoices.length === 0) return <p className="muted state">Nenhuma fatura.</p>;
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nº</th>
              {showAcademy && <th>Academia</th>}
              <th>Referência</th>
              <th className="num">Valor</th>
              <th>Vencimento</th>
              <th>Situação</th>
              <th className="actions-col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(i => (
              <tr key={i.id}>
                <td>{i.number}</td>
                {showAcademy && (
                  <td>
                    {i.academy_id ? (
                      <Link to={`/clientes/${i.academy_id}`} className="row-title">
                        {i.academy_name}
                      </Link>
                    ) : (
                      <span>{i.academy_name} <span className="muted small">(excluída)</span></span>
                    )}
                  </td>
                )}
                <td>
                  {formatMonthLong(i.reference_month)}
                  {i.description && <div className="muted small">{i.description}</div>}
                </td>
                <td className="num">{formatCents(i.amount_cents)}</td>
                <td>{formatDay(i.due_date)}</td>
                <td>
                  {isOverdue(i) ? (
                    <span className="badge badge-rejected">Em atraso</span>
                  ) : (
                    <span className={`badge badge-${i.status === 'paid' ? 'active' : i.status === 'open' ? 'pending' : 'muted'}`}>
                      {INVOICE_LABEL[i.status]}
                    </span>
                  )}
                  {i.status === 'paid' && (
                    <div className="muted small">
                      {formatDay(i.paid_on)} · {i.payment_method ? METHOD_LABEL[i.payment_method] : ''}
                    </div>
                  )}
                </td>
                <td className="actions-col">
                  <div className="row-actions">
                    {i.status === 'open' && (
                      <>
                        <button type="button" className="btn btn-small btn-primary" onClick={() => setDialog({ kind: 'pay', invoice: i })}>
                          Marcar paga
                        </button>
                        <button type="button" className="btn btn-small btn-danger" onClick={() => setDialog({ kind: 'void', invoice: i })}>
                          Cancelar
                        </button>
                      </>
                    )}
                    {i.status === 'paid' && (
                      <button type="button" className="btn btn-small" onClick={() => setDialog({ kind: 'undo', invoice: i })}>
                        Desfazer pagamento
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialog?.kind === 'pay' && <PayDialog invoice={dialog.invoice} onDone={onChanged} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'undo' && (
        <ActionDialog
          title={`Desfazer o pagamento da fatura ${dialog.invoice.number}?`}
          confirmLabel="Desfazer pagamento"
          onConfirm={async () => {
            await api.setInvoiceStatus(dialog.invoice.id, 'open');
            onChanged();
          }}
          onClose={() => setDialog(null)}
        >
          <p>A fatura volta a ficar em aberto.</p>
        </ActionDialog>
      )}
      {dialog?.kind === 'void' && (
        <ActionDialog
          title={`Cancelar a fatura ${dialog.invoice.number}?`}
          confirmLabel="Cancelar fatura"
          danger
          onConfirm={async () => {
            await api.setInvoiceStatus(dialog.invoice.id, 'void');
            onChanged();
          }}
          onClose={() => setDialog(null)}
        >
          <p>A fatura continua no histórico como cancelada e o mês pode ser cobrado de novo.</p>
        </ActionDialog>
      )}
    </>
  );
}

function PayDialog({ invoice, onDone, onClose }: { invoice: InvoiceItem; onDone: () => void; onClose: () => void }) {
  const [paidOn, setPaidOn] = useState(today());
  const [method, setMethod] = useState<PaymentMethod>('pix');
  return (
    <ActionDialog
      title={`Fatura ${invoice.number} paga`}
      confirmLabel="Marcar como paga"
      disabled={!paidOn}
      onConfirm={async () => {
        await api.setInvoiceStatus(invoice.id, 'paid', paidOn, method);
        onDone();
      }}
      onClose={onClose}
    >
      <p>
        {formatCents(invoice.amount_cents)} · {formatMonthLong(invoice.reference_month)}
      </p>
      <div className="form-stack">
        <label className="field">
          <span>Pago em</span>
          <input type="date" value={paidOn} max={today()} onChange={e => setPaidOn(e.target.value)} />
        </label>
        <label className="field">
          <span>Forma de pagamento</span>
          <select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}>
            {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map(m => (
              <option key={m} value={m}>
                {METHOD_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </ActionDialog>
  );
}
