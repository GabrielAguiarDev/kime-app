import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions: ReactNode;
}

export function Modal({ title, children, onClose, actions }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Latest onClose without re-running the focus effect when its identity changes.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, select, button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, []);

  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && close.current()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={ref}>
        <h2 id="dialog-title">{title}</h2>
        <div className="dialog-body">{children}</div>
        <div className="dialog-actions">{actions}</div>
      </div>
    </div>
  );
}
