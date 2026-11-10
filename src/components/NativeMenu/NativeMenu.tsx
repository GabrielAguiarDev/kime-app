import { DefaultTrigger } from './DefaultTrigger';
import type { NativeMenuProps } from './types';

/** Platforms without a native menu (web): the trigger keeps its plain action. */
export function NativeMenu({ label, accessibilityLabel, onFallbackPress, Trigger = DefaultTrigger }: NativeMenuProps) {
  return (
    <Trigger accessibilityLabel={accessibilityLabel} onPress={onFallbackPress}>
      {label}
    </Trigger>
  );
}
