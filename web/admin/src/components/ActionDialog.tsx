import { useState, type ReactNode } from 'react';
import { errorMessage } from '../format';
import { Modal } from './Modal';

interface Props {
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** Disables the confirm button (ex.: nothing chosen yet). */
  disabled?: boolean;
  /** Stays open after a successful confirm (the dialog shows a result next). */
  keepOpen?: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/** A dialog that runs one action, shows its error and closes on success. */
export function ActionDialog({ title, children, confirmLabel, danger, disabled, keepOpen, onConfirm, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      if (keepOpen) setBusy(false);
      else onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={title}
      onClose={busy ? () => {} : onClose}
      actions={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            type="button"
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={confirm}
            disabled={busy || disabled}
          >
            {busy ? 'Salvando…' : confirmLabel}
          </button>
        </>
      }
    >
      {children}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
