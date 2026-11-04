/** 1500 → "1.500" (pt-BR). */
export const formatMl = (ml: number) => ml.toLocaleString('pt-BR');

const timeFormatters = new Map<string, Intl.DateTimeFormat>();

/** "14:05" in the profile time zone. */
export function formatTime(iso: string, timeZone: string): string {
  let formatter = timeFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone });
    timeFormatters.set(timeZone, formatter);
  }
  return formatter.format(new Date(iso));
}
