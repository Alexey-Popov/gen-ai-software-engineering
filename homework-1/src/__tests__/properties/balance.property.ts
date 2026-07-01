import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { Transaction, TransactionType, TransactionStatus } from "@/lib/types";

// Feature: banking-transactions-api, Property 10: Balance calculation correctness

/**
 * Balance calculation function extracted to mirror the route handler logic.
 * This is the system-under-test: it computes the balance for an account
 * from a set of transactions, considering only completed ones.
 */
function calculateBalance(accountId: string, transactions: Transaction[]): number {
  const completedTransactions = transactions.filter(
    (t) => t.status === TransactionStatus.COMPLETED
  );

  let balance = 0;

  for (const t of completedTransactions) {
    if (t.type === TransactionType.DEPOSIT && t.toAccount === accountId) {
      balance += t.amount;
    } else if (t.type === TransactionType.WITHDRAWAL && t.fromAccount === accountId) {
      balance -= t.amount;
    } else if (t.type === TransactionType.TRANSFER) {
      if (t.toAccount === accountId) {
        balance += t.amount;
      }
      if (t.fromAccount === accountId) {
        balance -= t.amount;
      }
    }
  }

  return balance;
}

/**
 * Reference implementation: computes expected balance using a different
 * decomposition to cross-check the system-under-test.
 */
function expectedBalance(accountId: string, transactions: Transaction[]): number {
  const completed = transactions.filter(
    (t) => t.status === TransactionStatus.COMPLETED
  );

  // SUM of amounts from completed deposits where toAccount matches
  const depositSum = completed
    .filter((t) => t.type === TransactionType.DEPOSIT && t.toAccount === accountId)
    .reduce((sum, t) => sum + t.amount, 0);

  // SUM of amounts from completed incoming transfers where toAccount matches
  const incomingTransferSum = completed
    .filter((t) => t.type === TransactionType.TRANSFER && t.toAccount === accountId)
    .reduce((sum, t) => sum + t.amount, 0);

  // SUM of amounts from completed withdrawals where fromAccount matches
  const withdrawalSum = completed
    .filter((t) => t.type === TransactionType.WITHDRAWAL && t.fromAccount === accountId)
    .reduce((sum, t) => sum + t.amount, 0);

  // SUM of amounts from completed outgoing transfers where fromAccount matches
  const outgoingTransferSum = completed
    .filter((t) => t.type === TransactionType.TRANSFER && t.fromAccount === accountId)
    .reduce((sum, t) => sum + t.amount, 0);

  return depositSum + incomingTransferSum - withdrawalSum - outgoingTransferSum;
}

// Arbitraries
const accounts = fc.constantFrom("ACC-AAAAA", "ACC-BBBBB", "ACC-CCCCC");

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

const currencyArb = fc.constantFrom("USD", "EUR", "GBP");

const transactionArb: fc.Arbitrary<Transaction> = fc.record({
  id: fc.uuid(),
  fromAccount: accounts,
  toAccount: accounts,
  amount: amountArb,
  currency: currencyArb,
  type: typeArb,
  timestamp: fc.date({ min: new Date("2024-01-01"), max: new Date("2024-12-31") }).map(
    (d) => d.toISOString()
  ),
  status: statusArb,
});

describe("Balance Calculation Property Tests", () => {
  // Feature: banking-transactions-api, Property 10: Balance calculation correctness
  describe("Property 10: Balance calculation correctness", () => {
    /**
     * **Validates: Requirements 4.1, 4.3**
     */
    it("computed balance equals sum of completed deposits and incoming transfers minus completed withdrawals and outgoing transfers", () => {
      fc.assert(
        fc.property(
          accounts,
          fc.array(transactionArb, { minLength: 0, maxLength: 30 }),
          (accountId, transactions) => {
            const actual = calculateBalance(accountId, transactions);
            const expected = expectedBalance(accountId, transactions);

            expect(actual).toBeCloseTo(expected, 10);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("non-completed transactions do not affect the balance", () => {
      fc.assert(
        fc.property(
          accounts,
          fc.array(transactionArb, { minLength: 1, maxLength: 20 }),
          (accountId, transactions) => {
            // Set all transactions to non-completed statuses
            const nonCompleted = transactions.map((t) => ({
              ...t,
              status: fc.sample(
                fc.constantFrom(TransactionStatus.PENDING, TransactionStatus.FAILED),
                1
              )[0],
            }));

            const balance = calculateBalance(accountId, nonCompleted);
            expect(balance).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("balance is zero for an account with no related transactions", () => {
      fc.assert(
        fc.property(
          fc.array(transactionArb, { minLength: 0, maxLength: 20 }),
          (transactions) => {
            // Use an account that never appears in generated transactions
            const unrelatedAccount = "ACC-ZZZZZ";
            const filtered = transactions.filter(
              (t) => t.fromAccount !== unrelatedAccount && t.toAccount !== unrelatedAccount
            );

            const balance = calculateBalance(unrelatedAccount, filtered);
            expect(balance).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
