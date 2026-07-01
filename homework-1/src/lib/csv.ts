/**
 * CSV export utility for banking transactions.
 * RFC 4180 compliant: fields containing commas, double quotes, or newlines
 * are enclosed in double quotes, and internal double quotes are escaped by doubling.
 */

import { Transaction } from "./types";

const CSV_HEADER = "id,fromAccount,toAccount,amount,currency,type,timestamp,status";

/**
 * Escapes a field value for CSV output per RFC 4180.
 * If the field contains a comma, double quote, or newline, wrap it in double quotes
 * and escape any internal double quotes by doubling them.
 */
function escapeField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Converts an array of transactions to a CSV string.
 * Always includes the header row. Returns header only for empty arrays.
 */
export function transactionsToCsv(transactions: Transaction[]): string {
  const rows: string[] = [CSV_HEADER];

  for (const t of transactions) {
    const fields = [
      escapeField(t.id),
      escapeField(t.fromAccount),
      escapeField(t.toAccount),
      escapeField(String(t.amount)),
      escapeField(t.currency),
      escapeField(t.type),
      escapeField(t.timestamp),
      escapeField(t.status),
    ];
    rows.push(fields.join(","));
  }

  return rows.join("\n");
}
