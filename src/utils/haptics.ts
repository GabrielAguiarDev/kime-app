import * as Haptics from 'expo-haptics';

/** Haptic feedback reserved for reward/confirmation moments. */
export const haptics = {
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
};
