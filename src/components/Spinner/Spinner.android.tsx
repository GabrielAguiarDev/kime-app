import { requireOptionalNativeModule } from 'expo';
import { ActivityIndicator, View } from 'react-native';

import { useAppTheme } from '@theme';

import type { SpinnerProps } from './types';

// @expo/ui loads its native module at import time: only require it when the
// build has it, so an older dev client keeps the plain spinner.
const hasExpoUI = !!requireOptionalNativeModule('ExpoUI');

/** Side of the indicator in dp (Material's default is 48: too big inline and inside buttons). */
const SIZE = 32;

/**
 * Android: Material 3 Expressive loading indicator (morphing shapes) in the accent color,
 * instead of the plain circular spinner. Same props as the iOS one.
 */
export function Spinner({ color, accessibilityLabel }: SpinnerProps) {
  const { colors } = useAppTheme();
  const tint = color ?? colors.accent;
  if (!hasExpoUI) return <ActivityIndicator color={tint} accessibilityLabel={accessibilityLabel} />;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: native module may be absent
  const ui = require('@expo/ui/jetpack-compose') as typeof import('@expo/ui/jetpack-compose');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: native module may be absent
  const mods = require('@expo/ui/jetpack-compose/modifiers') as typeof import('@expo/ui/jetpack-compose/modifiers');
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? 'Carregando'}
      style={{ alignSelf: 'center', width: SIZE, height: SIZE }}
    >
      <ui.Host style={{ width: SIZE, height: SIZE }}>
        <ui.LoadingIndicator color={tint} modifiers={[mods.size(SIZE, SIZE)]} />
      </ui.Host>
    </View>
  );
}
