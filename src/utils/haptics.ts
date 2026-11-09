import * as Haptics from 'expo-haptics';

/** Haptics per moment (DESIGN-SYSTEM.md, section 7). */
export const haptics = {
  /** Tap on a tactile button or card. */
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  /** The ninja appears in the app intro. */
  intro: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  /** Water logged. */
  water: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  /** Check-in confirmed, goal reached, new belt (and other confirmations). */
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};
