import { Pressable } from 'react-native';

import type { NativeMenuTrigger } from './types';

/** Plain pressable trigger: the label draws its own look. */
export const DefaultTrigger: NativeMenuTrigger = ({ accessibilityLabel, onPress, children }) => (
  <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}>
    {children}
  </Pressable>
);
