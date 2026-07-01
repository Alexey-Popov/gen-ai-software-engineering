import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { create, getAll, filter, reset } from "@/lib/store";
import { TransactionType } from "@/lib/types";
import type { CreateTransactionInput, Transaction } from "@/lib/types";

// Fixed account set so filters actually match some transactions
const accountArb = fc.constantFrom("ACC-AAAAA", "ACC-BBBBB", "ACC-CCCCC", "ACC-DDDDD");

// Transaction type arbitrary
const typeArb = fc.constantFrom(
  TransactionType.DEPOSIT,
  TransactionType.WITHDRAWAL,
  TransactionType.TRANSFER
);

// Amount: positive with max 2 decimal places
const amountArb = fc.integer({ min: 1, max: 99999 }).map((n) => n / 100);

// Currency arbitrary
const currencyArb = fc.constantFrom("USD", "EUR", "GBP");

// Arbitrary for valid CreateTransactionInput
const createTransactionInputArb: fc.Arbitrary<CreateTransactionInput> = fc.record({
  fromAccount: accountArb,
  toAccount: accountArb,
  amount: amountArb,
  currency: currencyArb,
  type: typeArb,
});

// Helper: create a batch of transactions and return the stored transactions
function createBatch(inputs: CreateTransactionInput[]): Transaction[] {
  return inputs.map((input) => create(input));
}

describe("Filtering Property Tests", () => {
  beforeEach(() => {
    reset();
  });

  // Feature: banking-transactions-api, Property 5: Account ID filter correctness
  describe("Property 5: Account ID filter correctness", () => {
    /**
     * **Validates: Requirements 2.2**
     */
    it("filter({accountId}) returns exactly transactions where fromAccount or toAccount matches", () => {
      fc.assert(
        fc.property(
          fc.array(createTransactionInputArb, { minLength: 1, maxLength: 20 }),
          accountArb,
          (inputs, accountId) => {
            reset();
            createBatch(inputs);

            const all = getAll();
            const filtered = filter({ accountId });

            // Manual check: exactly those where fromAccount or toAccount matches
            const expected = all.filter(
              (t) => t.fromAccount === accountId || t.toAccount === accountId
            );

            expect(filtered.length).toBe(expected.length);
            for (const tx of expected) {
              expect(filtered.find((f) => f.id === tx.id)).toEqual(tx);
            }
            // No extra transactions in filtered result
            for (const tx of filtered) {
              expect(
                tx.fromAccount === accountId || tx.toAccount === accountId
              ).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: banking-transactions-api, Property 6: Type filter correctness
  describe("Property 6: Type filter correctness", () => {
    /**
     * **Validates: Requirements 2.3**
     */
    it("filter({type}) returns exactly transactions where transaction.type matches", () => {
      fc.assert(
        fc.property(
          fc.array(createTransactionInputArb, { minLength: 1, maxLength: 20 }),
          typeArb,
          (inputs, type) => {
            reset();
            createBatch(inputs);

            const all = getAll();
            const filtered = filter({ type });

            // Manual check: exactly those where type matches
            const expected = all.filter((t) => t.type === type);

            expect(filtered.length).toBe(expected.length);
            for (const tx of expected) {
              expect(filtered.find((f) => f.id === tx.id)).toEqual(tx);
            }
            // No extra transactions in filtered result
            for (const tx of filtered) {
              expect(tx.type).toBe(type);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: banking-transactions-api, Property 7: Date range filter correctness
  describe("Property 7: Date range filter correctness", () => {
    /**
     * **Validates: Requirements 2.4**
     */
    it("filter({from, to}) returns exactly transactions whose timestamp is within [from, to]", () => {
      fc.assert(
        fc.property(
          fc.array(createTransactionInputArb, { minLength: 1, maxLength: 20 }),
          (inputs) => {
            reset();
            createBatch(inputs);

            const all = getAll();
            if (all.length === 0) return;

            // Use the actual timestamps from stored transactions to construct a meaningful range
            const timestamps = all.map((t) => new Date(t.timestamp).getTime());
            const minTs = Math.min(...timestamps);
            const maxTs = Math.max(...timestamps);

            // Create a date range that covers some subset
            // Use the midpoint to split — from = minTs, to = midpoint
            const midTs = Math.floor((minTs + maxTs) / 2);
            const from = new Date(minTs).toISOString();
            const to = new Date(midTs).toISOString();

            const fromTime = new Date(from).getTime();
            const toTime = new Date(to).getTime();

            const filtered = filter({ from, to });

            // Manual check: exactly those with timestamp in [from, to]
            const expected = all.filter((t) => {
              const ts = new Date(t.timestamp).getTime();
              return ts >= fromTime && ts <= toTime;
            });

            expect(filtered.length).toBe(expected.length);
            for (const tx of expected) {
              expect(filtered.find((f) => f.id === tx.id)).toEqual(tx);
            }
            // All filtered results are within range
            for (const tx of filtered) {
              const ts = new Date(tx.timestamp).getTime();
              expect(ts >= fromTime).toBe(true);
              expect(ts <= toTime).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: banking-transactions-api, Property 8: Combined filters equal intersection of individual filters
  describe("Property 8: Combined filters equal intersection of individual filters", () => {
    /**
     * **Validates: Requirements 2.5**
     */
    it("applying all filters together equals the intersection of applying each individually", () => {
      fc.assert(
        fc.property(
          fc.array(createTransactionInputArb, { minLength: 1, maxLength: 20 }),
          accountArb,
          typeArb,
          (inputs, accountId, type) => {
            reset();
            createBatch(inputs);

            // Apply combined filter
            const combined = filter({ accountId, type });

            // Apply each filter individually
            const byAccount = filter({ accountId });
            const byType = filter({ type });

            // Intersection of individual filters
            const byAccountIds = new Set(byAccount.map((t) => t.id));
            const byTypeIds = new Set(byType.map((t) => t.id));
            const intersectionIds = new Set(
              [...byAccountIds].filter((id) => byTypeIds.has(id))
            );

            const combinedIds = new Set(combined.map((t) => t.id));

            // Combined should equal the intersection
            expect(combinedIds.size).toBe(intersectionIds.size);
            for (const id of intersectionIds) {
              expect(combinedIds.has(id)).toBe(true);
            }
            for (const id of combinedIds) {
              expect(intersectionIds.has(id)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
