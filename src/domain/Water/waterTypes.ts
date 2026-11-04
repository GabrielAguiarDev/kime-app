/** A water log as kept on the device. `id` is generated here and reused on
 * every sync attempt, so re-sending is idempotent (upsert by id). */
export interface WaterLog {
  id: string;
  amountMl: number;
  /** ISO timestamp. */
  loggedAt: string;
  synced: boolean;
}
