import { requireOptionalNativeModule } from 'expo';
import type { ButtonProps } from '@expo/ui/swift-ui';

import { DefaultTrigger } from './DefaultTrigger';
import type { NativeMenuProps } from './types';

// @expo/ui loads its native views at import time: only require it when the
// build has the module, so an older dev client keeps the plain button.
const hasExpoUI = !!requireOptionalNativeModule('ExpoUI');

/**
 * Native UIMenu (SwiftUI `Menu`, opened with one tap; iOS 26 draws it in
 * glass). The options are an inline picker, so the selected one shows the
 * system check. `actions` come after a divider.
 */
export function NativeMenu({
  label,
  accessibilityLabel,
  options,
  selectedId,
  onSelect,
  actions,
  Trigger = DefaultTrigger,
  onFallbackPress,
}: NativeMenuProps) {
  if (!hasExpoUI) {
    return (
      <Trigger accessibilityLabel={accessibilityLabel} onPress={onFallbackPress}>
        {label}
      </Trigger>
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
        {actions?.length ? (
          <>
            <ui.Divider />
            {actions.map((a) => (
              <ui.Button
                key={a.title}
                label={a.title}
                systemImage={a.systemImage as ButtonProps['systemImage']}
                onPress={a.onPress}
              />
            ))}
          </>
        ) : null}
      </ui.Menu>
    </ui.Host>
  );
}
