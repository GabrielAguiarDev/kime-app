import { requireOptionalNativeModule } from 'expo';

import { HeaderButton } from '../NativeHeader/NativeHeader';
import type { HeaderMenuProps } from './types';

// @expo/ui loads its native views at import time: only require it when the
// build has the module, so an older dev client keeps the plain button.
const hasExpoUI = !!requireOptionalNativeModule('ExpoUI');

/**
 * Native UIMenu (SwiftUI `Menu`, opened with one tap; iOS 26 draws it in
 * glass). The options are an inline picker, so the selected one shows the
 * system check; `extraAction` comes after a divider.
 */
export function HeaderMenu({
  label,
  accessibilityLabel,
  options,
  selectedId,
  onSelect,
  extraAction,
  onFallbackPress,
}: HeaderMenuProps) {
  if (!hasExpoUI) {
    return (
      <HeaderButton accessibilityLabel={accessibilityLabel} onPress={onFallbackPress}>
        {label}
      </HeaderButton>
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: native module may be absent
  const ui = require('@expo/ui/swift-ui') as typeof import('@expo/ui/swift-ui');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: native module may be absent
  const mods = require('@expo/ui/swift-ui/modifiers') as typeof import('@expo/ui/swift-ui/modifiers');

  return (
    <ui.Host matchContents colorScheme="dark">
      <ui.Menu
        label={<ui.RNHostView matchContents>{label}</ui.RNHostView>}
        modifiers={[mods.accessibilityLabel(accessibilityLabel)]}
      >
        <ui.Picker
          selection={selectedId}
          onSelectionChange={(id: string | null) => {
            if (id) onSelect(id);
          }}
          modifiers={[mods.pickerStyle('inline')]}
        >
          {options.map((o) => (
            <ui.Text key={o.id} modifiers={[mods.tag(o.id)]}>
              {o.title}
            </ui.Text>
          ))}
        </ui.Picker>
        {extraAction ? (
          <>
            <ui.Divider />
            <ui.Button label={extraAction.title} onPress={extraAction.onPress} />
          </>
        ) : null}
      </ui.Menu>
    </ui.Host>
  );
}
