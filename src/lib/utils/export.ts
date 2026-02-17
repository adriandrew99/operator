/**
 * CSV / Data Export Utilities
 * Generates downloadable CSV files from structured data.
 */

type Row = Record<string, string | number | boolean | null | undefined>;

/** Convert an array of objects to a CSV string */
export function toCSV(rows: Row[], columns?: { key: string; label: string }[]): string {
  if (rows.length === 0) return '';

  const cols = columns || Object.keys(rows[0]).map(k => ({ key: k, label: k }));
  const header = cols.map(c => escapeCSV(c.label)).join(',');
  const body = rows.map(row =>
    cols.map(c => escapeCSV(String(row[c.key] ?? ''))).join(',')
  ).join('\n');

  return `${header}\n${body}`;
}

function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/** Trigger a browser download of a CSV string */
export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Download JSON data as a file */
export function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Format a date for filenames (YYYY-MM-DD) */
export function fileDate(): string {
  return new Date().toISOString().split('T')[0];
}
