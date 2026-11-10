import { requireOptionalNativeModule } from 'expo';

import { useAppTheme } from '@theme';

import { JsWheelPicker } from './JsWheelPicker';
import { WHEEL_VISIBLE_ROWS, type WheelPickerProps } from './types';

// @expo/ui loads its native views at import time: only require it when the
// build has the module (same guard as NativeMenu).
const hasExpoUI = !!requireOptionalNativeModule('ExpoUI');

/** iOS: the system wheel (SwiftUI `Picker` with the wheel style), one column. */
export function WheelPicker<T extends string | number>(props: WheelPickerProps<T>) {
  const { size } = useAppTheme();
  if (!hasExpoUI) return <JsWheelPicker {...props} />;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: native module may be absent
  const ui = require('@expo/ui/swift-ui') as typeof import('@expo/ui/swift-ui');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: native module may be absent
  const mods = require('@expo/ui/swift-ui/modifiers') as typeof import('@expo/ui/swift-ui/modifiers');
  const { options, value, onChange, accessibilityLabel } = props;

  return (
    <ui.Host colorScheme="dark" style={{ height: size.touchTarget * WHEEL_VISIBLE_ROWS }}>
      <ui.Picker
        selection={value}
        onSelectionChange={(next: T) => {
          if (next !== null && next !== undefined) onChange(next);
        }}
        modifiers={[mods.pickerStyle('wheel'), mods.accessibilityLabel(accessibilityLabel)]}
      >
        {options.map((o) => (
          <ui.Text key={String(o.value)} modifiers={[mods.tag(o.value)]}>
            {o.label}
          </ui.Text>
        ))}
      </ui.Picker>
    </ui.Host>
  );
}
