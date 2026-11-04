/** Brazilian time zones offered in the academy settings (IANA names). */
export const BR_TIMEZONES: { id: string; label: string; description: string }[] = [
  { id: 'America/Sao_Paulo', label: 'Brasília', description: 'SP, RJ, MG, Sul, GO, DF, BA, Nordeste…' },
  { id: 'America/Manaus', label: 'Amazonas', description: 'AM, RR, RO, MT, MS (−1h)' },
  { id: 'America/Rio_Branco', label: 'Acre', description: 'AC (−2h)' },
  { id: 'America/Noronha', label: 'Fernando de Noronha', description: '+1h' },
];

export function timezoneLabel(id: string): string {
  return BR_TIMEZONES.find((t) => t.id === id)?.label ?? id;
}
