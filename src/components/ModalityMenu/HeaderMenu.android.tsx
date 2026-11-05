import { requireOptionalNativeModule } from 'expo';
import { useState } from 'react';
import { View } from 'react-native';

import { useAppTheme } from '@theme';

import { HeaderButton } from '../NativeHeader/NativeHeader';
import type { HeaderMenuProps } from './types';

// @expo/ui loads its native module at import time: only require it when the
// build has it, so an older dev client keeps the plain button.
const hasExpoUI = !!requireOptionalNativeModule('ExpoUI');

/**
 * Native dropdown (Compose `DropdownMenuPopup`) anchored to the header item.
 * The selected option uses the Material selected item; `extraAction` sits in
 * a group of its own after a gap (Compose's separator between groups).
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
  const [expanded, setExpanded] = useState(false);
  const { spacing } = useAppTheme();

  if (!hasExpoUI) {
    return (
      <HeaderButton accessibilityLabel={accessibilityLabel} onPress={onFallbackPress}>
        {label}
      </HeaderButton>
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: native module may be absent
  const ui = require('@expo/ui/jetpack-compose') as typeof import('@expo/ui/jetpack-compose');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: native module may be absent
  const mods = require('@expo/ui/jetpack-compose/modifiers') as typeof import('@expo/ui/jetpack-compose/modifiers');
  const close = () => setExpanded(false);

  return (
    <ui.Host matchContents colorScheme="dark">
      <ui.Box>
        <ui.RNHostView matchContents>
          <HeaderButton accessibilityLabel={accessibilityLabel} onPress={() => setExpanded(true)}>
            <View>{label}</View>
          </HeaderButton>
        </ui.RNHostView>
        <ui.DropdownMenuPopup expanded={expanded} onDismissRequest={close}>
          <ui.DropdownMenuGroup>
            {options.map((o, index) => (
              <ui.SelectableDropdownMenuItem
                key={o.id}
                selected={o.id === selectedId}
                shapes={{ index, count: options.length }}
                onClick={() => {
                  close();
                  onSelect(o.id);
                }}
              >
                <ui.SelectableDropdownMenuItem.Text>
                  <ui.Text>{o.title}</ui.Text>
                </ui.SelectableDropdownMenuItem.Text>
              </ui.SelectableDropdownMenuItem>
            ))}
          </ui.DropdownMenuGroup>
          {extraAction ? (
            <>
              <ui.Spacer modifiers={[mods.height(spacing.s4)]} />
              <ui.DropdownMenuGroup>
                <ui.DropdownMenuItem
                  onClick={() => {
                    close();
                    extraAction.onPress();
                  }}
                >
                  <ui.DropdownMenuItem.Text>
                    <ui.Text>{extraAction.title}</ui.Text>
                  </ui.DropdownMenuItem.Text>
                </ui.DropdownMenuItem>
              </ui.DropdownMenuGroup>
            </>
          ) : null}
        </ui.DropdownMenuPopup>
      </ui.Box>
    </ui.Host>
  );
}
