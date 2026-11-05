import type { ReactElement } from 'react';

export interface HeaderMenuOption {
  id: string;
  title: string;
}

export interface HeaderMenuProps {
  /** RN view shown in the header (the trigger); it must not handle touches itself. */
  label: ReactElement;
  accessibilityLabel: string;
  options: HeaderMenuOption[];
  /** Option with the check. */
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Last item, after a separator (e.g. "Trocar academia"). */
  extraAction?: { title: string; onPress: () => void };
  /** Build without the @expo/ui native module (old dev client): a tap runs this instead. */
  onFallbackPress: () => void;
}
