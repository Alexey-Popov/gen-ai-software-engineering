import { Transaction } from '../transactions/entities/transaction.entity';

const COLUMNS: (keyof Transaction)[] = [
  'id',
  'fromAccount',
  'toAccount',
  'amount',
  'currency',
  'type',
  'timestamp',
  'status',
];

/** Escapes a value for CSV per RFC 4180 (quotes fields containing comma, quote or newline). */
function escapeCsv(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Serialises a list of transactions to a CSV string with a header row. */
export function transactionsToCsv(transactions: Transaction[]): string {
  const header = COLUMNS.join(',');
  const rows = transactions.map((t) => COLUMNS.map((c) => escapeCsv(t[c])).join(','));
  return [header, ...rows].join('\n');
}
