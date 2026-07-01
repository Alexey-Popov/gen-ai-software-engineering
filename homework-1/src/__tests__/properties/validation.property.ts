import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { validateTransaction } from "@/lib/validator";

// Feature: banking-transactions-api, Property 2: Validation rejects all invalid fields with correct errors
// Feature: banking-transactions-api, Property 3: Validation returns all errors simultaneously

/**
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 10.2
 */

const VALID_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "CNY", "INR", "BRL", "MXN", "KRW", "SGD", "HKD"];
const VALID_TYPES = ["deposit", "withdrawal", "transfer"];

// --- Arbitraries ---

const alphanumChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const validAccountArb = fc.tuple(
  fc.constantFrom(...alphanumChars.split("")),
  fc.constantFrom(...alphanumChars.split("")),
  fc.constantFrom(...alphanumChars.split("")),
  fc.constantFrom(...alphanumChars.split("")),
  fc.constantFrom(...alphanumChars.split(""))
).map(([a, b, c, d, e]) => `ACC-${a}${b}${c}${d}${e}`);

const invalidAccountArb = fc.oneof(
  fc.constant(""),
  fc.constant("ACC-"),
  fc.constant("ACC-123"),      // too short
  fc.constant("ACC-1234567"),  // too long
  fc.constant("INVALID"),      // no prefix
  fc.constant("acc-ABCDE"),    // wrong case prefix
  fc.constant("ACC-!!!??"),    // special chars
  fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz".split("")), { minLength: 1, maxLength: 10 })
    .filter(s => !/^ACC-[A-Za-z0-9]{5}$/.test(s))
);

const validAmountArb = fc.integer({ min: 1, max: 9999999 }).map(n => n / 100);

const invalidAmountNonPositiveArb = fc.oneof(
  fc.constant(0),
  fc.constant(-1),
  fc.integer({ min: -100000, max: -1 }).map(n => n / 100)
);

const invalidAmountTooManyDecimalsArb = fc.integer({ min: 1, max: 999999 }).map(n => n / 1000)
  .filter(n => {
    const scaled = Math.round(n * 100);
    return Math.abs(scaled - n * 100) > 1e-9;
  });

const validCurrencyArb = fc.constantFrom(...VALID_CURRENCIES);

const invalidCurrencyArb = fc.oneof(
  fc.constant("INVALID"),
  fc.constant("XYZ"),
  fc.constant("usd"),   // lowercase
  fc.constant("US"),    // too short
  fc.stringOf(fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")), { minLength: 1, maxLength: 5 })
    .filter(s => !VALID_CURRENCIES.includes(s))
);

const validTypeArb = fc.constantFrom(...VALID_TYPES);

const invalidTypeArb = fc.oneof(
  fc.constant("DEPOSIT"),    // wrong case
  fc.constant("invalid"),
  fc.constant("send"),
  fc.constant("receive"),
  fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz".split("")), { minLength: 1, maxLength: 10 })
    .filter(s => !VALID_TYPES.includes(s))
);

// Helper: Build a transaction input where specific fields are invalid
type FieldValidity = {
  fromAccount: boolean;
  toAccount: boolean;
  amount: boolean;
  currency: boolean;
  type: boolean;
};

function buildInputArb(validity: FieldValidity) {
  const fromAccountArb = validity.fromAccount ? validAccountArb : invalidAccountArb;
  const toAccountArb = validity.toAccount ? validAccountArb : invalidAccountArb;
  const amountArb = validity.amount ? validAmountArb : fc.oneof(invalidAmountNonPositiveArb, invalidAmountTooManyDecimalsArb);
  const currencyArb = validity.currency ? validCurrencyArb : invalidCurrencyArb;
  const typeArb = validity.type ? validTypeArb : invalidTypeArb;

  return fc.record({
    fromAccount: fromAccountArb,
    toAccount: toAccountArb,
    amount: amountArb,
    currency: currencyArb,
    type: typeArb,
  });
}

describe("Property 2: Validation rejects all invalid fields with correct errors", () => {
  // **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

  it("should return an error for each invalid field and no errors for valid fields", () => {
    // Generate inputs with random combinations of valid/invalid fields (at least one invalid)
    const fieldValidityArb = fc.record({
      fromAccount: fc.boolean(),
      toAccount: fc.boolean(),
      amount: fc.boolean(),
      currency: fc.boolean(),
      type: fc.boolean(),
    }).filter(v => !v.fromAccount || !v.toAccount || !v.amount || !v.currency || !v.type); // at least one invalid

    fc.assert(
      fc.property(fieldValidityArb, (validity) => {
        // Build a concrete input based on the validity map
        const inputArb = buildInputArb(validity);

        fc.assert(
          fc.property(inputArb, (input) => {
            const errors = validateTransaction(input);
            const errorFields = errors.map(e => e.field);

            // For each invalid field, there must be an error naming that field
            if (!validity.fromAccount) {
              expect(errorFields).toContain("fromAccount");
            }
            if (!validity.toAccount) {
              expect(errorFields).toContain("toAccount");
            }
            if (!validity.amount) {
              expect(errorFields).toContain("amount");
            }
            if (!validity.currency) {
              expect(errorFields).toContain("currency");
            }
            if (!validity.type) {
              expect(errorFields).toContain("type");
            }

            // For each valid field, there must be NO error naming that field
            if (validity.fromAccount) {
              expect(errorFields).not.toContain("fromAccount");
            }
            if (validity.toAccount) {
              expect(errorFields).not.toContain("toAccount");
            }
            if (validity.amount) {
              expect(errorFields).not.toContain("amount");
            }
            if (validity.currency) {
              expect(errorFields).not.toContain("currency");
            }
            if (validity.type) {
              expect(errorFields).not.toContain("type");
            }
          }),
          { numRuns: 20 } // inner runs per validity combination
        );
      }),
      { numRuns: 100 }
    );
  });

  it("should reject inputs with invalid fromAccount format", () => {
    fc.assert(
      fc.property(
        invalidAccountArb,
        validAccountArb,
        validAmountArb,
        validCurrencyArb,
        validTypeArb,
        (fromAccount, toAccount, amount, currency, type) => {
          const errors = validateTransaction({ fromAccount, toAccount, amount, currency, type });
          const errorFields = errors.map(e => e.field);
          expect(errorFields).toContain("fromAccount");
          expect(errorFields).not.toContain("toAccount");
          expect(errorFields).not.toContain("amount");
          expect(errorFields).not.toContain("currency");
          expect(errorFields).not.toContain("type");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should reject inputs with invalid amount", () => {
    fc.assert(
      fc.property(
        validAccountArb,
        validAccountArb,
        fc.oneof(invalidAmountNonPositiveArb, invalidAmountTooManyDecimalsArb),
        validCurrencyArb,
        validTypeArb,
        (fromAccount, toAccount, amount, currency, type) => {
          const errors = validateTransaction({ fromAccount, toAccount, amount, currency, type });
          const errorFields = errors.map(e => e.field);
          expect(errorFields).toContain("amount");
          expect(errorFields).not.toContain("fromAccount");
          expect(errorFields).not.toContain("toAccount");
          expect(errorFields).not.toContain("currency");
          expect(errorFields).not.toContain("type");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should reject inputs with invalid currency", () => {
    fc.assert(
      fc.property(
        validAccountArb,
        validAccountArb,
        validAmountArb,
        invalidCurrencyArb,
        validTypeArb,
        (fromAccount, toAccount, amount, currency, type) => {
          const errors = validateTransaction({ fromAccount, toAccount, amount, currency, type });
          const errorFields = errors.map(e => e.field);
          expect(errorFields).toContain("currency");
          expect(errorFields).not.toContain("fromAccount");
          expect(errorFields).not.toContain("toAccount");
          expect(errorFields).not.toContain("amount");
          expect(errorFields).not.toContain("type");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should reject inputs with invalid type", () => {
    fc.assert(
      fc.property(
        validAccountArb,
        validAccountArb,
        validAmountArb,
        validCurrencyArb,
        invalidTypeArb,
        (fromAccount, toAccount, amount, currency, type) => {
          const errors = validateTransaction({ fromAccount, toAccount, amount, currency, type });
          const errorFields = errors.map(e => e.field);
          expect(errorFields).toContain("type");
          expect(errorFields).not.toContain("fromAccount");
          expect(errorFields).not.toContain("toAccount");
          expect(errorFields).not.toContain("amount");
          expect(errorFields).not.toContain("currency");
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Property 3: Validation returns all errors simultaneously", () => {
  // **Validates: Requirements 5.6, 10.2**

  it("should return exactly N errors when N fields are invalid", () => {
    // Generate inputs with a known number of invalid fields (2-5)
    const invalidCountArb = fc.integer({ min: 2, max: 5 });

    // Choose which fields to make invalid
    const allFields: (keyof FieldValidity)[] = ["fromAccount", "toAccount", "amount", "currency", "type"];

    fc.assert(
      fc.property(
        invalidCountArb,
        fc.shuffledSubarray(allFields, { minLength: 2, maxLength: 5 }),
        (_, invalidFields) => {
          const n = invalidFields.length;
          const validity: FieldValidity = {
            fromAccount: !invalidFields.includes("fromAccount"),
            toAccount: !invalidFields.includes("toAccount"),
            amount: !invalidFields.includes("amount"),
            currency: !invalidFields.includes("currency"),
            type: !invalidFields.includes("type"),
          };

          const inputArb = buildInputArb(validity);

          fc.assert(
            fc.property(inputArb, (input) => {
              const errors = validateTransaction(input);
              expect(errors).toHaveLength(n);

              // Each error should reference one of the invalid fields
              const errorFields = errors.map(e => e.field);
              for (const field of invalidFields) {
                expect(errorFields).toContain(field);
              }
            }),
            { numRuns: 20 } // inner runs per field combination
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should return all errors in a single response rather than stopping at first error", () => {
    // All 5 fields invalid → must get exactly 5 errors
    const allInvalidArb = buildInputArb({
      fromAccount: false,
      toAccount: false,
      amount: false,
      currency: false,
      type: false,
    });

    fc.assert(
      fc.property(allInvalidArb, (input) => {
        const errors = validateTransaction(input);
        expect(errors).toHaveLength(5);

        const errorFields = errors.map(e => e.field);
        expect(errorFields).toContain("fromAccount");
        expect(errorFields).toContain("toAccount");
        expect(errorFields).toContain("amount");
        expect(errorFields).toContain("currency");
        expect(errorFields).toContain("type");
      }),
      { numRuns: 100 }
    );
  });
});
