// Feature: banking-transactions-api, Property 13: CSV export round-trip

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { transactionsToCsv } from "../../lib/csv";
import { Transaction, TransactionType, TransactionStatus } from "../../lib/types";

/**
 * Simple RFC 4180 CSV parser for round-trip testing.
 * Handles quoted fields (commas, quotes, newlines inside quotes).
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote (doubled)
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        current += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
        i++;
      } else {
        current += ch;
        i++;
      }
    }
  }

  fields.push(current);
  return fields;
}

/**
 * Parse a full CSV string into an array of rows (each row is an array of fields).
 * Handles newlines within quoted fields.
 */
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let currentLine = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < csv.length && csv[i + 1] === '"') {
          currentLine += '""';
          i++;
        } else {
          inQuotes = false;
          currentLine += ch;
        }
      } else {
        currentLine += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        currentLine += ch;
      } else if (ch === "\n") {
        rows.push(parseCsvLine(currentLine));
        currentLine = "";
      } else if (ch === "\r") {
        // Skip \r, handle \r\n
        if (i + 1 < csv.length && csv[i + 1] === "\n") {
          i++;
        }
        rows.push(parseCsvLine(currentLine));
        currentLine = "";
      } else {
        currentLine += ch;
      }
    }
  }

  // Push last line if not empty
  if (currentLine.length > 0) {
    rows.push(parseCsvLine(currentLine));
  }

  return rows;
}

// Arbitrary for generating simple Transaction objects with safe alphanumeric fields
const transactionArbitrary: fc.Arbitrary<Transaction> = fc.record({
  id: fc.stringMatching(/^[A-Za-z0-9]{1,36}$/),
  fromAccount: fc.stringMatching(/^ACC-[A-Za-z0-9]{5}$/),
  toAccount: fc.stringMatching(/^ACC-[A-Za-z0-9]{5}$/),
  amount: fc.float({ min: Math.fround(0.01), max: Math.fround(999999.99), noNaN: true, noDefaultInfinity: true }).map(
    (v) => Math.round(v * 100) / 100
  ),
  currency: fc.constantFrom("USD", "EUR", "GBP"),
  type: fc.constantFrom(TransactionType.DEPOSIT, TransactionType.WITHDRAWAL, TransactionType.TRANSFER),
  timestamp: fc.date({ min: new Date("2000-01-01"), max: new Date("2030-12-31") }).map((d) => d.toISOString()),
  status: fc.constantFrom(TransactionStatus.PENDING, TransactionStatus.COMPLETED, TransactionStatus.FAILED),
});

describe("Property 13: CSV export round-trip", () => {
  // **Validates: Requirements 8.1, 8.2, 8.3**

  it("header row contains exactly the expected columns", () => {
    fc.assert(
      fc.property(fc.array(transactionArbitrary, { minLength: 0, maxLength: 20 }), (transactions) => {
        const csv = transactionsToCsv(transactions);
        const rows = parseCsv(csv);

        // There must be at least a header row
        expect(rows.length).toBeGreaterThanOrEqual(1);

        const header = rows[0];
        expect(header).toEqual(["id", "fromAccount", "toAccount", "amount", "currency", "type", "timestamp", "status"]);
      }),
      { numRuns: 100 }
    );
  });

  it("number of data rows equals number of transactions", () => {
    fc.assert(
      fc.property(fc.array(transactionArbitrary, { minLength: 0, maxLength: 20 }), (transactions) => {
        const csv = transactionsToCsv(transactions);
        const rows = parseCsv(csv);

        // First row is header, rest are data rows
        const dataRows = rows.slice(1);
        expect(dataRows.length).toBe(transactions.length);
      }),
      { numRuns: 100 }
    );
  });

  it("each parsed row matches the corresponding transaction fields", () => {
    fc.assert(
      fc.property(fc.array(transactionArbitrary, { minLength: 1, maxLength: 20 }), (transactions) => {
        const csv = transactionsToCsv(transactions);
        const rows = parseCsv(csv);
        const dataRows = rows.slice(1);

        for (let i = 0; i < transactions.length; i++) {
          const t = transactions[i];
          const row = dataRows[i];

          expect(row[0]).toBe(t.id);
          expect(row[1]).toBe(t.fromAccount);
          expect(row[2]).toBe(t.toAccount);
          expect(row[3]).toBe(String(t.amount));
          expect(row[4]).toBe(t.currency);
          expect(row[5]).toBe(t.type);
          expect(row[6]).toBe(t.timestamp);
          expect(row[7]).toBe(t.status);
        }
      }),
      { numRuns: 100 }
    );
  });
});
