import { HeaderButton } from '../NativeHeader/NativeHeader';
import { NativeMenu } from './NativeMenu';
import type { HeaderMenuProps, NativeMenuTrigger } from './types';

const HeaderTrigger: NativeMenuTrigger = ({ accessibilityLabel, onPress, children }) => (
  <HeaderButton accessibilityLabel={accessibilityLabel} onPress={onPress}>
    {children}
  </HeaderButton>
);

/** Native menu anchored to a header item (e.g. the student's modality on Início). */
export function HeaderMenu({ extraAction, ...props }: HeaderMenuProps) {
  return <NativeMenu {...props} Trigger={HeaderTrigger} actions={extraAction ? [extraAction] : undefined} />;
}
