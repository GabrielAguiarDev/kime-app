import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

import { ConfirmSheet, type ConfirmOptions } from '@components';

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/** One confirmation sheet for the whole app; screens ask through `useConfirm()`. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  // Stays false while the sheet runs its exit motion; options clear on onClosed.
  const [visible, setVisible] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((next) => {
    // A new request answers the previous one as "cancel".
    resolver.current?.(false);
    setOptions(next);
    setVisible(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setVisible(false);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options ? (
        <ConfirmSheet
          {...options}
          visible={visible}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
          onClosed={() => setOptions(null)}
        />
      ) : null}
    </ConfirmContext.Provider>
  );
}

/** `if (await confirm({...})) doIt()` */
export function useConfirm(): Confirm {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}
