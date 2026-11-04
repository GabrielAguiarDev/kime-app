/**
 * A water log as kept in the storage shared with the widgets (one key per log).
 * `id` is generated on the device (app or widget) and reused on every sync
 * attempt, so re-sending is idempotent (upsert by id).
 */
export interface WaterLog {
  id: string;
  userId: string;
  amountMl: number;
  /** ISO 8601, UTC. */
  loggedAt: string;
  /** Where it was logged. The widget button writes `widget`. */
  source: 'app' | 'widget';
  /** Already on the server (as it is now). */
  synced: boolean;
  /** Undone: removed from the totals; the server copy is deleted on the next sync. */
  deleted: boolean;
}

/** What the widgets need to work without the app (written by the app). */
export interface WaterWidgetConfig {
  userId: string;
  /** Null until the bottle is set up: the widget shows "Configure sua garrafa". */
  bottleMl: number | null;
  /** Null without a weight (and without a professor's plan, phase 4). */
  goalMl: number | null;
  /** IANA zone of the profile: defines "today". */
  timeZone: string;
}

/** Today in the profile time zone. */
export interface WaterDay {
  /** YYYY-MM-DD. */
  date: string;
  /** Oldest first. */
  logs: WaterLog[];
  totalMl: number;
}
