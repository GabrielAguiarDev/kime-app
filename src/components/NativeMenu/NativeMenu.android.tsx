import { requireOptionalNativeModule } from 'expo';
import { useState } from 'react';
import { View } from 'react-native';

import { useAppTheme } from '@theme';

import { DefaultTrigger } from './DefaultTrigger';
import type { NativeMenuProps } from './types';

// @expo/ui loads its native module at import time: only require it when the
// build has it, so an older dev client keeps the plain button.
const hasExpoUI = !!requireOptionalNativeModule('ExpoUI');

/** Wider than Material's default so short option lists don't look cramped. */
const MIN_WIDTH = 220;

/**
 * Native dropdown (Compose `DropdownMenuPopup`) anchored to the trigger.
 * The selected option uses the Material selected item; `actions` sit in a group of their own after a gap
 * (Compose's separator between groups).
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
  const [expanded, setExpanded] = useState(false);
  const { spacing, colors, size, textVariants } = useAppTheme();

  if (!hasExpoUI) {
    return (
      <Trigger accessibilityLabel={accessibilityLabel} onPress={onFallbackPress}>
        {label}
      </Trigger>
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: native module may be absent
  const ui = require('@expo/ui/jetpack-compose') as typeof import('@expo/ui/jetpack-compose');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: native module may be absent
  const mods = require('@expo/ui/jetpack-compose/modifiers') as typeof import('@expo/ui/jetpack-compose/modifiers');
  const close = () => setExpanded(false);

  // App look instead of Material defaults (purple selection, small thin text):
  // card surface, accent selection, Inter 16 and items as tall as a button.
  const groupCount = actions?.length ? 2 : 1;
  const groupProps = { containerColor: colors.surface, modifiers: [mods.defaultMinSize({ minWidth: MIN_WIDTH })] };
  const itemModifiers = [mods.defaultMinSize({ minHeight: size.button })];
  const itemText = { fontFamily: textVariants.bodyStrong.fontFamily, fontSize: textVariants.bodyStrong.fontSize };

  return (
    <ui.Host matchContents colorScheme="dark">
      <ui.Box>
        <ui.RNHostView matchContents>
          <Trigger accessibilityLabel={accessibilityLabel} onPress={() => setExpanded(true)}>
            <View>{label}</View>
          </Trigger>
        </ui.RNHostView>
        <ui.DropdownMenuPopup expanded={expanded} onDismissRequest={close}>
          <ui.DropdownMenuGroup {...groupProps} shapes={{ index: 0, count: groupCount }}>
            {options.map((o, index) => (
              <ui.SelectableDropdownMenuItem
                key={o.id}
                selected={o.id === selectedId}
                shapes={{ index, count: options.length }}
                modifiers={itemModifiers}
                colors={{
                  textColor: colors.text,
                  containerColor: colors.surface,
                  selectedTextColor: colors.accent,
                  selectedContainerColor: colors.accentSelected,
                }}
                onClick={() => {
                  close();
                  onSelect(o.id);
                }}
              >
                <ui.SelectableDropdownMenuItem.Text>
                  <ui.Text style={itemText}>{o.title}</ui.Text>
                </ui.SelectableDropdownMenuItem.Text>
              </ui.SelectableDropdownMenuItem>
            ))}
          </ui.DropdownMenuGroup>
          {actions?.length ? (
            <>
              <ui.Spacer modifiers={[mods.height(spacing.s4)]} />
              <ui.DropdownMenuGroup {...groupProps} shapes={{ index: 1, count: groupCount }}>
                {actions.map((a) => (
                  <ui.DropdownMenuItem
                    key={a.title}
                    modifiers={itemModifiers}
                    elementColors={{ textColor: colors.text }}
                    onClick={() => {
                      close();
                      a.onPress();
                    }}
                  >
                    <ui.DropdownMenuItem.Text>
                      <ui.Text style={itemText}>{a.title}</ui.Text>
                    </ui.DropdownMenuItem.Text>
                  </ui.DropdownMenuItem>
                ))}
              </ui.DropdownMenuGroup>
            </>
          ) : null}
        </ui.DropdownMenuPopup>
      </ui.Box>
    </ui.Host>
  );
}
