import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  Transaction,
  TransactionType,
  TransactionStatus,
  SummaryResponse,
} from "@/lib/types";

// Feature: banking-transactions-api, Property 11: Summary aggregation correctness

/**
 * Helper function that mirrors the summary route handler logic.
 * Given an accountId and a set of transactions, computes the summary.
 */
function calculateSummary(
  accountId: string,
  transactions: Transaction[]
): SummaryResponse {
  const accountTransactions = transactions.filter(
    (t) => t.fromAccount === accountId || t.toAccount === accountId
  );

  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let mostRecentTransactionDate: string | null = null;

  for (const t of accountTransactions) {
    if (t.type === TransactionType.DEPOSIT && t.toAccount === accountId) {
      totalDeposits += t.amount;
    }
    if (
      t.type === TransactionType.WITHDRAWAL &&
      t.fromAccount === accountId
    ) {
      totalWithdrawals += t.amount;
    }

    if (
      mostRecentTransactionDate === null ||
      new Date(t.timestamp).getTime() >
        new Date(mostRecentTransactionDate).getTime()
    ) {
      mostRecentTransactionDate = t.timestamp;
    }
  }

  return {
    accountId,
    totalDeposits,
    totalWithdrawals,
    transactionCount: accountTransactions.length,
    mostRecentTransactionDate,
  };
}

// Arbitraries
const accountArb = fc.constantFrom("ACC-AAAAA", "ACC-BBBBB", "ACC-CCCCC");
const amountArb = fc.integer({ min: 1, max: 99999 }).map((n) => n / 100);
const typeArb = fc.constantFrom(
  TransactionType.DEPOSIT,
  TransactionType.WITHDRAWAL,
  TransactionType.TRANSFER
);
const statusArb = fc.constantFrom(
  TransactionStatus.PENDING,
  TransactionStatus.COMPLETED,
  TransactionStatus.FAILED
);
const timestampArb = fc
  .date({ min: new Date("2020-01-01"), max: new Date("2025-12-31") })
  .map((d) => d.toISOString());

const transactionArb: fc.Arbitrary<Transaction> = fc.record({
  id: fc.uuid(),
  fromAccount: accountArb,
  toAccount: accountArb,
  amount: amountArb,
  currency: fc.constantFrom("USD", "EUR", "GBP"),
  type: typeArb,
  timestamp: timestampArb,
  status: statusArb,
});

describe("Summary Aggregation Property Tests", () => {
  // Feature: banking-transactions-api, Property 11: Summary aggregation correctness
  describe("Property 11: Summary aggregation correctness", () => {
    /**
     * **Validates: Requirements 6.1, 6.2**
     */
    it("summary matches manual calculation for any set of transactions and target account", () => {
      fc.assert(
        fc.property(
          fc.array(transactionArb, { minLength: 1, maxLength: 30 }),
          accountArb,
          (transactions, targetAccount) => {
            const summary = calculateSummary(targetAccount, transactions);

            // Manually compute expected values
            const involving = transactions.filter(
              (t) =>
                t.fromAccount === targetAccount ||
                t.toAccount === targetAccount
            );

            const expectedDeposits = involving
              .filter(
                (t) =>
                  t.type === TransactionType.DEPOSIT &&
                  t.toAccount === targetAccount
              )
              .reduce((sum, t) => sum + t.amount, 0);

            const expectedWithdrawals = involving
              .filter(
                (t) =>
                  t.type === TransactionType.WITHDRAWAL &&
                  t.fromAccount === targetAccount
              )
              .reduce((sum, t) => sum + t.amount, 0);

            const expectedCount = involving.length;

            const expectedMostRecent =
              involving.length > 0
                ? involving.reduce((latest, t) =>
                    new Date(t.timestamp).getTime() >
                    new Date(latest.timestamp).getTime()
                      ? t
                      : latest
                  ).timestamp
                : null;

            expect(summary.accountId).toBe(targetAccount);
            expect(summary.totalDeposits).toBeCloseTo(expectedDeposits, 10);
            expect(summary.totalWithdrawals).toBeCloseTo(
              expectedWithdrawals,
              10
            );
            expect(summary.transactionCount).toBe(expectedCount);
            expect(summary.mostRecentTransactionDate).toBe(expectedMostRecent);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("returns zeros and null when no transactions involve the target account", () => {
      fc.assert(
        fc.property(
          fc.array(transactionArb, { minLength: 0, maxLength: 20 }),
          (transactions) => {
            // Use an account that is NOT in the arbitraries to guarantee no match
            const isolatedAccount = "ACC-ZZZZZ";

            // Filter out any transactions that accidentally involve the isolated account
            const filtered = transactions.filter(
              (t) =>
                t.fromAccount !== isolatedAccount &&
                t.toAccount !== isolatedAccount
            );

            const summary = calculateSummary(isolatedAccount, filtered);

            expect(summary.accountId).toBe(isolatedAccount);
            expect(summary.totalDeposits).toBe(0);
            expect(summary.totalWithdrawals).toBe(0);
            expect(summary.transactionCount).toBe(0);
            expect(summary.mostRecentTransactionDate).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
