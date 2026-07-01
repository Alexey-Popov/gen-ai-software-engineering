import { describe, it, expect } from "vitest";
import {
  validateTransaction,
  validateAccountId,
  validateRateParam,
  validateDaysParam,
} from "@/lib/validator";
import { TransactionType } from "@/lib/types";

describe("validateTransaction", () => {
  const validInput = {
    fromAccount: "ACC-12345",
    toAccount: "ACC-67890",
    amount: 100.5,
    currency: "USD",
    type: TransactionType.TRANSFER,
  };

  it("should return no errors for a valid transaction", () => {
    const errors = validateTransaction(validInput);
    expect(errors).toHaveLength(0);
  });

  it("should return an error if input is null", () => {
    const errors = validateTransaction(null);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("body");
  });

  it("should return an error if input is undefined", () => {
    const errors = validateTransaction(undefined);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("body");
  });

  it("should return an error if input is not an object", () => {
    const errors = validateTransaction("not an object");
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("body");
  });

  // Required fields
  describe("required fields", () => {
    it("should return errors for all missing required fields", () => {
      const errors = validateTransaction({});
      expect(errors.length).toBe(5);
      const fields = errors.map((e) => e.field);
      expect(fields).toContain("fromAccount");
      expect(fields).toContain("toAccount");
      expect(fields).toContain("amount");
      expect(fields).toContain("currency");
      expect(fields).toContain("type");
    });

    it("should flag fromAccount as required when missing", () => {
      const { fromAccount, ...rest } = validInput;
      const errors = validateTransaction(rest);
      expect(errors.some((e) => e.field === "fromAccount")).toBe(true);
    });

    it("should flag toAccount as required when missing", () => {
      const { toAccount, ...rest } = validInput;
      const errors = validateTransaction(rest);
      expect(errors.some((e) => e.field === "toAccount")).toBe(true);
    });

    it("should flag amount as required when missing", () => {
      const { amount, ...rest } = validInput;
      const errors = validateTransaction(rest);
      expect(errors.some((e) => e.field === "amount")).toBe(true);
    });

    it("should flag currency as required when missing", () => {
      const { currency, ...rest } = validInput;
      const errors = validateTransaction(rest);
      expect(errors.some((e) => e.field === "currency")).toBe(true);
    });

    it("should flag type as required when missing", () => {
      const { type, ...rest } = validInput;
      const errors = validateTransaction(rest);
      expect(errors.some((e) => e.field === "type")).toBe(true);
    });
  });

  // Amount validation
  describe("amount validation", () => {
    it("should reject zero amount", () => {
      const errors = validateTransaction({ ...validInput, amount: 0 });
      expect(errors.some((e) => e.field === "amount")).toBe(true);
    });

    it("should reject negative amount", () => {
      const errors = validateTransaction({ ...validInput, amount: -50 });
      expect(errors.some((e) => e.field === "amount")).toBe(true);
    });

    it("should reject amount with more than 2 decimal places", () => {
      const errors = validateTransaction({ ...validInput, amount: 10.123 });
      expect(errors.some((e) => e.field === "amount")).toBe(true);
    });

    it("should accept amount with exactly 2 decimal places", () => {
      const errors = validateTransaction({ ...validInput, amount: 99.99 });
      expect(errors).toHaveLength(0);
    });

    it("should accept whole number amounts", () => {
      const errors = validateTransaction({ ...validInput, amount: 100 });
      expect(errors).toHaveLength(0);
    });

    it("should accept amount with 1 decimal place", () => {
      const errors = validateTransaction({ ...validInput, amount: 10.5 });
      expect(errors).toHaveLength(0);
    });

    it("should reject NaN", () => {
      const errors = validateTransaction({ ...validInput, amount: NaN });
      expect(errors.some((e) => e.field === "amount")).toBe(true);
    });

    it("should reject Infinity", () => {
      const errors = validateTransaction({ ...validInput, amount: Infinity });
      expect(errors.some((e) => e.field === "amount")).toBe(true);
    });
  });

  // Account format validation
  describe("account format validation", () => {
    it("should reject fromAccount without ACC- prefix", () => {
      const errors = validateTransaction({ ...validInput, fromAccount: "12345" });
      expect(errors.some((e) => e.field === "fromAccount")).toBe(true);
    });

    it("should reject fromAccount with wrong number of chars after prefix", () => {
      const errors = validateTransaction({ ...validInput, fromAccount: "ACC-1234" });
      expect(errors.some((e) => e.field === "fromAccount")).toBe(true);
    });

    it("should reject fromAccount with 6 chars after prefix", () => {
      const errors = validateTransaction({ ...validInput, fromAccount: "ACC-123456" });
      expect(errors.some((e) => e.field === "fromAccount")).toBe(true);
    });

    it("should reject fromAccount with special characters", () => {
      const errors = validateTransaction({ ...validInput, fromAccount: "ACC-12!45" });
      expect(errors.some((e) => e.field === "fromAccount")).toBe(true);
    });

    it("should accept fromAccount with alphanumeric chars", () => {
      const errors = validateTransaction({ ...validInput, fromAccount: "ACC-Ab1C2" });
      expect(errors).toHaveLength(0);
    });

    it("should reject toAccount without ACC- prefix", () => {
      const errors = validateTransaction({ ...validInput, toAccount: "XYZ-12345" });
      expect(errors.some((e) => e.field === "toAccount")).toBe(true);
    });

    it("should reject toAccount with fewer than 5 chars after prefix", () => {
      const errors = validateTransaction({ ...validInput, toAccount: "ACC-123" });
      expect(errors.some((e) => e.field === "toAccount")).toBe(true);
    });
  });

  // Currency validation
  describe("currency validation", () => {
    it("should accept valid ISO 4217 codes", () => {
      const validCurrencies = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "CNY", "INR", "BRL", "MXN", "KRW", "SGD", "HKD"];
      for (const currency of validCurrencies) {
        const errors = validateTransaction({ ...validInput, currency });
        expect(errors).toHaveLength(0);
      }
    });

    it("should reject invalid currency code", () => {
      const errors = validateTransaction({ ...validInput, currency: "XYZ" });
      expect(errors.some((e) => e.field === "currency")).toBe(true);
    });

    it("should reject lowercase currency code", () => {
      const errors = validateTransaction({ ...validInput, currency: "usd" });
      expect(errors.some((e) => e.field === "currency")).toBe(true);
    });

    it("should reject empty string currency", () => {
      const errors = validateTransaction({ ...validInput, currency: "" });
      expect(errors.some((e) => e.field === "currency")).toBe(true);
    });
  });

  // Type validation
  describe("type validation", () => {
    it("should accept 'deposit'", () => {
      const errors = validateTransaction({ ...validInput, type: "deposit" });
      expect(errors).toHaveLength(0);
    });

    it("should accept 'withdrawal'", () => {
      const errors = validateTransaction({ ...validInput, type: "withdrawal" });
      expect(errors).toHaveLength(0);
    });

    it("should accept 'transfer'", () => {
      const errors = validateTransaction({ ...validInput, type: "transfer" });
      expect(errors).toHaveLength(0);
    });

    it("should reject invalid type", () => {
      const errors = validateTransaction({ ...validInput, type: "invalid" });
      expect(errors.some((e) => e.field === "type")).toBe(true);
    });

    it("should reject uppercase type", () => {
      const errors = validateTransaction({ ...validInput, type: "DEPOSIT" });
      expect(errors.some((e) => e.field === "type")).toBe(true);
    });
  });

  // Multiple errors at once
  describe("collects all errors simultaneously", () => {
    it("should return multiple errors when multiple fields are invalid", () => {
      const errors = validateTransaction({
        fromAccount: "INVALID",
        toAccount: "INVALID",
        amount: -5.555,
        currency: "XYZ",
        type: "invalid",
      });
      expect(errors.length).toBeGreaterThanOrEqual(4);
      const fields = errors.map((e) => e.field);
      expect(fields).toContain("fromAccount");
      expect(fields).toContain("toAccount");
      expect(fields).toContain("amount");
      expect(fields).toContain("currency");
      expect(fields).toContain("type");
    });

    it("should return exactly N errors for N invalid fields", () => {
      const errors = validateTransaction({
        fromAccount: "BAD",
        toAccount: "ACC-12345",
        amount: 100,
        currency: "INVALID",
        type: "deposit",
      });
      expect(errors).toHaveLength(2);
      const fields = errors.map((e) => e.field);
      expect(fields).toContain("fromAccount");
      expect(fields).toContain("currency");
    });
  });
});

describe("validateAccountId", () => {
  it("should return true for valid account IDs", () => {
    expect(validateAccountId("ACC-12345")).toBe(true);
    expect(validateAccountId("ACC-ABCDE")).toBe(true);
    expect(validateAccountId("ACC-Ab1C2")).toBe(true);
  });

  it("should return false for missing ACC- prefix", () => {
    expect(validateAccountId("12345")).toBe(false);
  });

  it("should return false for wrong prefix", () => {
    expect(validateAccountId("XYZ-12345")).toBe(false);
  });

  it("should return false for too short ID", () => {
    expect(validateAccountId("ACC-1234")).toBe(false);
  });

  it("should return false for too long ID", () => {
    expect(validateAccountId("ACC-123456")).toBe(false);
  });

  it("should return false for special characters", () => {
    expect(validateAccountId("ACC-12!45")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(validateAccountId("")).toBe(false);
  });
});

describe("validateRateParam", () => {
  it("should return true for positive numbers", () => {
    expect(validateRateParam(0.05)).toBe(true);
    expect(validateRateParam(1)).toBe(true);
    expect(validateRateParam(0.001)).toBe(true);
  });

  it("should return true for positive number strings", () => {
    expect(validateRateParam("0.05")).toBe(true);
    expect(validateRateParam("5")).toBe(true);
  });

  it("should return false for zero", () => {
    expect(validateRateParam(0)).toBe(false);
  });

  it("should return false for negative numbers", () => {
    expect(validateRateParam(-0.05)).toBe(false);
  });

  it("should return false for null/undefined/empty", () => {
    expect(validateRateParam(null)).toBe(false);
    expect(validateRateParam(undefined)).toBe(false);
    expect(validateRateParam("")).toBe(false);
  });

  it("should return false for non-numeric strings", () => {
    expect(validateRateParam("abc")).toBe(false);
  });

  it("should return false for NaN", () => {
    expect(validateRateParam(NaN)).toBe(false);
  });

  it("should return false for Infinity", () => {
    expect(validateRateParam(Infinity)).toBe(false);
  });
});

describe("validateDaysParam", () => {
  it("should return true for positive integers", () => {
    expect(validateDaysParam(1)).toBe(true);
    expect(validateDaysParam(30)).toBe(true);
    expect(validateDaysParam(365)).toBe(true);
  });

  it("should return true for positive integer strings", () => {
    expect(validateDaysParam("30")).toBe(true);
    expect(validateDaysParam("365")).toBe(true);
  });

  it("should return false for non-integers", () => {
    expect(validateDaysParam(1.5)).toBe(false);
    expect(validateDaysParam(30.1)).toBe(false);
  });

  it("should return false for zero", () => {
    expect(validateDaysParam(0)).toBe(false);
  });

  it("should return false for negative integers", () => {
    expect(validateDaysParam(-10)).toBe(false);
  });

  it("should return false for null/undefined/empty", () => {
    expect(validateDaysParam(null)).toBe(false);
    expect(validateDaysParam(undefined)).toBe(false);
    expect(validateDaysParam("")).toBe(false);
  });

  it("should return false for non-numeric strings", () => {
    expect(validateDaysParam("abc")).toBe(false);
  });

  it("should return false for floating-point strings", () => {
    expect(validateDaysParam("1.5")).toBe(false);
  });

  it("should return false for NaN", () => {
    expect(validateDaysParam(NaN)).toBe(false);
  });

  it("should return false for Infinity", () => {
    expect(validateDaysParam(Infinity)).toBe(false);
  });
});
