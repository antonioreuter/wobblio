// RFC4180 CSV serialization for the §14 data export. A field is quoted only when it contains a
// comma, quote, or newline; embedded quotes are doubled. null/undefined render as an empty field.
export function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.map(escapeField).join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeField(row[header])).join(','));
  }
  return lines.join('\r\n');
}

function escapeField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = value instanceof Date ? value.toISOString() : String(value);
  if (!/[",\r\n]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}
