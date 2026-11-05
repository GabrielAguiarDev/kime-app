import { HeaderButton } from '../NativeHeader/NativeHeader';
import type { HeaderMenuProps } from './types';

/** Platforms without a native menu (web): the trigger keeps its plain action. */
export function HeaderMenu({ label, accessibilityLabel, onFallbackPress }: HeaderMenuProps) {
  return (
    <HeaderButton accessibilityLabel={accessibilityLabel} onPress={onFallbackPress}>
      {label}
    </HeaderButton>
  );
}
