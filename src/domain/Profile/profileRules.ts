import type { Sex } from './profileTypes';

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'female', label: 'Feminino' },
  { value: 'male', label: 'Masculino' },
  { value: 'unspecified', label: 'Prefiro não informar' },
];

/** Typing digits becomes `DD/MM/AAAA`. */
export function maskBirthDate(text: string): string {
  const d = text.replace(/\D/g, '').slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

/**
 * `DD/MM/AAAA` → `YYYY-MM-DD`; null when it is not a real date, before 1900
 * or after `today` (`YYYY-MM-DD`, local).
 */
export function parseBirthDate(text: string, today: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const iso = `${yyyy}-${mm}-${dd}`;
  if (year < 1900 || iso > today) return null;
  return iso;
}

/** `YYYY-MM-DD` → `DD/MM/AAAA`. */
export function formatBirthDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}
