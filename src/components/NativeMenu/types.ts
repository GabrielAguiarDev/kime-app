import type { ComponentType, ReactElement, ReactNode } from 'react';

export interface NativeMenuOption {
  id: string;
  title: string;
}

export interface NativeMenuAction {
  title: string;
  /** SF Symbol shown on iOS (e.g. "plus"). */
  systemImage?: string;
  onPress: () => void;
}

/** Pressable wrapping the label where the menu is not opened natively by the label itself. */
export type NativeMenuTrigger = ComponentType<{ accessibilityLabel: string; onPress: () => void; children: ReactNode }>;

export interface NativeMenuProps {
  /** RN view of the trigger; it must not handle touches itself. */
  label: ReactElement;
  accessibilityLabel: string;
  options: NativeMenuOption[];
  /** Option with the check. */
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Items after a separator (e.g. "Trocar academia"). */
  actions?: NativeMenuAction[];
  /** Pressable around `label` on Android and on the fallback. Default: a plain Pressable. */
  Trigger?: NativeMenuTrigger;
  /** Build without the @expo/ui native module (old dev client): a tap runs this instead. */
  onFallbackPress: () => void;
}

export interface HeaderMenuProps extends Omit<NativeMenuProps, 'Trigger' | 'actions'> {
  /** Last item, after a separator (e.g. "Trocar academia"). */
  extraAction?: { title: string; onPress: () => void };
}
