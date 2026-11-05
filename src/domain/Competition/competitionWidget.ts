import { sharedStore } from '@infra/widget';

/**
 * Data of the countdown widget (targets/widgets/CountdownWidget.swift,
 * modules/kimi-widget/.../CountdownWidget.kt). Contract:
 *   competition.championships      JSON {userId, timeZone, items: [{name, date (YYYY-MM-DD), location, modalityId}]}
 *   competition.selectedModality   JSON {modalityId, name, competes}: the modality picked in the
 *                                  app's Início header. The widget only counts down to items of
 *                                  that modality; `competes` false (or no item in it) = discreet
 *                                  empty state "Nenhum campeonato em {name}". Missing = every item.
 * The widget picks the first item on or after its local "today", so a
 * championship that passes with the app closed rolls over to the next one.
 */
export const CHAMPIONSHIPS_KEY = 'competition.championships';
export const SELECTED_MODALITY_KEY = 'competition.selectedModality';

export interface CountdownWidgetData {
  userId: string;
  timeZone: string;
  items: { name: string; date: string; location: string; modalityId: string }[];
}

export interface CountdownWidgetModality {
  modalityId: string;
  name: string;
  /** The student competes (accepted) in this modality. */
  competes: boolean;
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

function readModality(): CountdownWidgetModality | null {
  const raw = sharedStore.getItem(SELECTED_MODALITY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CountdownWidgetModality;
  } catch {
    return null;
  }
}

/** Writes (or clears, with null) the selected modality; reloads the widgets only on a change. */
function publishModality(data: CountdownWidgetModality | null): void {
  if (JSON.stringify(readModality()) === JSON.stringify(data)) return;
  if (data) sharedStore.setItem(SELECTED_MODALITY_KEY, JSON.stringify(data));
  else sharedStore.removeItem(SELECTED_MODALITY_KEY);
  sharedStore.reloadWidgets();
}

export const countdownWidget = { read, publish, readModality, publishModality };
