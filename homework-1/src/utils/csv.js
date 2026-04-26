// Minimal RFC 4180 CSV serializer — no external dependency.
// Escapes a value if it contains a comma, double-quote, or newline.
function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(rows, columns) {
  const header = columns.join(',');
  const body = rows.map((row) => columns.map((col) => escapeCell(row[col])).join(',')).join('\r\n');
  return rows.length === 0 ? header : `${header}\r\n${body}`;
}
