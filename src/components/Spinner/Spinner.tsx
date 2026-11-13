import { ActivityIndicator } from 'react-native';

import type { SpinnerProps } from './types';

/** iOS (and fallback): the system activity indicator. Android: see Spinner.android.tsx. */
export function Spinner({ color, accessibilityLabel }: SpinnerProps) {
  return <ActivityIndicator color={color} accessibilityLabel={accessibilityLabel} />;
}
