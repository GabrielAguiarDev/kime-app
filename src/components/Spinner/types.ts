import type { ColorValue } from 'react-native';

export interface SpinnerProps {
  /** Default: the system gray on iOS, `textMuted` on Android (same look). */
  color?: ColorValue;
  accessibilityLabel?: string;
}
