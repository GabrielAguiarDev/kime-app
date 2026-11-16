/** Downloads rows as a CSV that Excel (pt-BR) opens directly: ';' separator, UTF-8 BOM. */
export function downloadCsv<T>(filename: string, rows: T[], columns: [header: string, value: (row: T) => unknown][]) {
  const cell = (v: unknown) => {
    const text = v == null ? '' : String(v);
    // Quotes when needed; a leading =,+,-,@ is prefixed so spreadsheets don't run it as a formula.
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [columns.map(([h]) => cell(h)).join(';'), ...rows.map(r => columns.map(([, f]) => cell(f(r))).join(';'))];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Cents as a plain decimal for spreadsheets ("179,90"). */
export const csvMoney = (cents: number | null) => (cents == null ? '' : (cents / 100).toFixed(2).replace('.', ','));
