export interface WaterTodaySnapshot {
  userId: string;
  totalMl: number;
  updatedAt: string;
}

/**
 * Storage shared with the home-screen widget (iOS App Group / Android
 * SharedPreferences). The native widget targets and the module that writes to
 * that storage arrive with the widget phase; until then this is a no-op so
 * every water change already goes through here.
 */
export const sharedWidgetStorage = {
  // TODO(widget): write to the App Group / SharedPreferences store.
  setWaterToday(_snapshot: WaterTodaySnapshot): void {},
};
