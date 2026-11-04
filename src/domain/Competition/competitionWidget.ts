import { sharedStore } from '@infra/widget';

/**
 * Data of the countdown widget (targets/widgets/CountdownWidget.swift,
 * modules/kimi-widget/.../CountdownWidget.kt). Contract:
 *   competition.championships  JSON {userId, timeZone, items: [{name, date (YYYY-MM-DD), location}]}
 * The widget picks the first item on or after its local "today", so a
 * championship that passes with the app closed rolls over to the next one.
 */
export const CHAMPIONSHIPS_KEY = 'competition.championships';

export interface CountdownWidgetData {
  userId: string;
  timeZone: string;
  items: { name: string; date: string; location: string }[];
}

function read(): CountdownWidgetData | null {
  const raw = sharedStore.getItem(CHAMPIONSHIPS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CountdownWidgetData;
  } catch {
    return null;
  }
}

/** Writes (or clears, with null) the widget data; reloads the widgets only on a change. */
function publish(data: CountdownWidgetData | null): void {
  if (JSON.stringify(read()) === JSON.stringify(data)) return;
  if (data) sharedStore.setItem(CHAMPIONSHIPS_KEY, JSON.stringify(data));
  else sharedStore.removeItem(CHAMPIONSHIPS_KEY);
  sharedStore.reloadWidgets();
}

export const countdownWidget = { read, publish };
