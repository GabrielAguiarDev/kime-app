import type { ColorValue } from 'react-native';

export interface SpinnerProps {
  /** Default: the system color on iOS, `accent` on Android. */
  color?: ColorValue;
  accessibilityLabel?: string;
}
