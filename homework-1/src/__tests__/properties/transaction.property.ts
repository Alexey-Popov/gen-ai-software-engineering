import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { create, getById, getAll, reset } from "@/lib/store";
import { TransactionType, TransactionStatus } from "@/lib/types";
import type { CreateTransactionInput } from "@/lib/types";

// UUID v4 regex
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ISO 8601 datetime regex (simplified, covers standard toISOString() output)
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;

// Arbitrary for valid account IDs: ACC- followed by 5 alphanumeric chars
const accountIdArb = fc
  .stringMatching(/^[A-Za-z0-9]{5}$/)
  .map((s) => `ACC-${s}`);

// Arbitrary for amount: positive float with max 2 decimals
const amountArb = fc
  .integer({ min: 1, max: 99999999 })
  .map((n) => Math.round(n) / 100);

// Arbitrary for currency
const currencyArb = fc.constantFrom("USD", "EUR", "GBP", "JPY", "CHF");

// Arbitrary for transaction type
const typeArb = fc.constantFrom(
  TransactionType.DEPOSIT,
  TransactionType.WITHDRAWAL,
  TransactionType.TRANSFER
);

// Arbitrary for valid CreateTransactionInput
const createTransactionInputArb: fc.Arbitrary<CreateTransactionInput> = fc.record(
  {
    fromAccount: accountIdArb,
    toAccount: accountIdArb,
    amount: amountArb,
    currency: currencyArb,
    type: typeArb,
  }
);

describe("Transaction Store Property Tests", () => {
  beforeEach(() => {
    reset();
  });

  // Feature: banking-transactions-api, Property 1: Transaction creation preserves invariants
  describe("Property 1: Transaction creation preserves invariants", () => {
    /**
     * **Validates: Requirements 1.1, 1.3, 1.4, 1.5**
     */
    it("creating a transaction produces a valid Transaction with correct invariants", () => {
      fc.assert(
        fc.property(createTransactionInputArb, (input) => {
          reset();
          const transaction = create(input);

          // id is a valid UUID v4
          expect(transaction.id).toMatch(UUID_V4_REGEX);

          // timestamp is a valid ISO 8601 datetime
          expect(transaction.timestamp).toMatch(ISO_8601_REGEX);

          // status is PENDING
          expect(transaction.status).toBe(TransactionStatus.PENDING);

          // All input fields are preserved unchanged
          expect(transaction.fromAccount).toBe(input.fromAccount);
          expect(transaction.toAccount).toBe(input.toAccount);
          expect(transaction.amount).toBe(input.amount);
          expect(transaction.currency).toBe(input.currency);
          expect(transaction.type).toBe(input.type);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: banking-transactions-api, Property 4: Unfiltered listing returns all stored transactions
  describe("Property 4: Unfiltered listing returns all stored transactions", () => {
    /**
     * **Validates: Requirements 2.1**
     */
    it("getAll() returns exactly the transactions that were created", () => {
      fc.assert(
        fc.property(
          fc.array(createTransactionInputArb, { minLength: 0, maxLength: 20 }),
          (inputs) => {
            reset();

            const created = inputs.map((input) => create(input));
            const all = getAll();

            // getAll() returns exactly N items
            expect(all.length).toBe(created.length);

            // All created transactions are present in getAll() result
            for (const tx of created) {
              expect(all.find((t) => t.id === tx.id)).toEqual(tx);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: banking-transactions-api, Property 9: Transaction lookup round-trip
  describe("Property 9: Transaction lookup round-trip", () => {
    /**
     * **Validates: Requirements 3.1, 3.2**
     */
    it("getById(id) returns the exact transaction that was stored", () => {
      fc.assert(
        fc.property(createTransactionInputArb, (input) => {
          reset();
          const transaction = create(input);

          const retrieved = getById(transaction.id);
          expect(retrieved).toEqual(transaction);
        }),
        { numRuns: 100 }
      );
    });

    it("getById returns undefined for IDs not in the store", () => {
      fc.assert(
        fc.property(
          fc.array(createTransactionInputArb, { minLength: 0, maxLength: 10 }),
          fc.uuid(),
          (inputs, randomId) => {
            reset();

            const createdIds = inputs.map((input) => create(input).id);

            // Only test if the random ID is not one of the created IDs
            if (!createdIds.includes(randomId)) {
              expect(getById(randomId)).toBeUndefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
