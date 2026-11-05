/**
 * Picks the modality the student's screens follow: the stored choice while the
 * student is still linked to it, otherwise the first available one (in the
 * order given, i.e. the academy's modality order). Null with no modality.
 */
export function resolveSelectedModality(linkedIds: readonly string[], stored: string | null): string | null {
  if (stored && linkedIds.includes(stored)) return stored;
  return linkedIds[0] ?? null;
}
