import { describe, it, expect } from "vitest";
import { transactionsToCsv } from "@/lib/csv";
import { Transaction, TransactionType, TransactionStatus } from "@/lib/types";

const EXPECTED_HEADER = "id,fromAccount,toAccount,amount,currency,type,timestamp,status";

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    fromAccount: "ACC-12345",
    toAccount: "ACC-67890",
    amount: 100.50,
    currency: "USD",
    type: TransactionType.TRANSFER,
    timestamp: "2024-01-15T10:30:00.000Z",
    status: TransactionStatus.COMPLETED,
    ...overrides,
  };
}

describe("transactionsToCsv", () => {
  it("should return only the header row for an empty array", () => {
    const result = transactionsToCsv([]);
    expect(result).toBe(EXPECTED_HEADER);
  });

  it("should include the correct header row", () => {
    const result = transactionsToCsv([]);
    const headerLine = result.split("\n")[0];
    expect(headerLine).toBe("id,fromAccount,toAccount,amount,currency,type,timestamp,status");
  });

  it("should produce one data row per transaction plus header", () => {
    const transactions = [makeTransaction(), makeTransaction({ id: "another-id" })];
    const lines = transactionsToCsv(transactions).split("\n");
    expect(lines).toHaveLength(3); // header + 2 data rows
  });

  it("should correctly serialize a simple transaction", () => {
    const t = makeTransaction();
    const result = transactionsToCsv([t]);
    const lines = result.split("\n");
    expect(lines[1]).toBe(
      "550e8400-e29b-41d4-a716-446655440000,ACC-12345,ACC-67890,100.5,USD,transfer,2024-01-15T10:30:00.000Z,completed"
    );
  });

  it("should escape fields containing commas by wrapping in double quotes", () => {
    const t = makeTransaction({ id: "id,with,commas" });
    const result = transactionsToCsv([t]);
    const lines = result.split("\n");
    expect(lines[1]).toContain('"id,with,commas"');
  });

  it("should escape fields containing double quotes by doubling them", () => {
    const t = makeTransaction({ id: 'id"with"quotes' });
    const result = transactionsToCsv([t]);
    const lines = result.split("\n");
    expect(lines[1]).toContain('"id""with""quotes"');
  });

  it("should escape fields containing newlines by wrapping in double quotes", () => {
    const t = makeTransaction({ id: "id\nwith\nnewlines" });
    const result = transactionsToCsv([t]);
    // The field should be quoted
    expect(result).toContain('"id\nwith\nnewlines"');
  });

  it("should escape fields containing carriage returns", () => {
    const t = makeTransaction({ id: "id\rwith\rcr" });
    const result = transactionsToCsv([t]);
    expect(result).toContain('"id\rwith\rcr"');
  });

  it("should handle fields with both commas and quotes", () => {
    const t = makeTransaction({ id: 'has "comma", here' });
    const result = transactionsToCsv([t]);
    // Should be: "has ""comma"", here"
    expect(result).toContain('"has ""comma"", here"');
  });

  it("should serialize amount as a number string", () => {
    const t = makeTransaction({ amount: 0.01 });
    const result = transactionsToCsv([t]);
    const lines = result.split("\n");
    expect(lines[1]).toContain(",0.01,");
  });

  it("should handle integer amounts without unnecessary decimals", () => {
    const t = makeTransaction({ amount: 500 });
    const result = transactionsToCsv([t]);
    const lines = result.split("\n");
    expect(lines[1]).toContain(",500,");
  });
});
