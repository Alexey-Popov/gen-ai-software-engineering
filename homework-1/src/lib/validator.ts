/**
 * Input validation logic for the Banking Transactions API.
 * Pure functions that validate input and return structured error arrays.
 */

import { TransactionType, type ValidationError } from "./types";

/**
 * Supported ISO 4217 currency codes.
 */
const VALID_CURRENCIES = new Set([
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CHF",
  "CAD",
  "AUD",
  "NZD",
  "CNY",
  "INR",
  "BRL",
  "MXN",
  "KRW",
  "SGD",
  "HKD",
]);

/**
 * Pattern for valid account IDs: ACC- followed by exactly 5 alphanumeric characters.
 */
const ACCOUNT_ID_PATTERN = /^ACC-[A-Za-z0-9]{5}$/;

/**
 * Valid TransactionType enum values.
 */
const VALID_TYPES = new Set(Object.values(TransactionType));

/**
 * Validates a full transaction creation input.
 * Collects and returns ALL validation errors simultaneously.
 */
export function validateTransaction(input: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (input === null || input === undefined || typeof input !== "object") {
    errors.push({ field: "body", message: "Request body must be an object" });
    return errors;
  }

  const data = input as Record<string, unknown>;

  // Check required fields presence
  if (data.fromAccount === undefined || data.fromAccount === null || data.fromAccount === "") {
    errors.push({ field: "fromAccount", message: "fromAccount is required" });
  } else if (typeof data.fromAccount !== "string" || !ACCOUNT_ID_PATTERN.test(data.fromAccount)) {
    errors.push({
      field: "fromAccount",
      message: "fromAccount must match format ACC-XXXXX (where X is alphanumeric)",
    });
  }

  if (data.toAccount === undefined || data.toAccount === null || data.toAccount === "") {
    errors.push({ field: "toAccount", message: "toAccount is required" });
  } else if (typeof data.toAccount !== "string" || !ACCOUNT_ID_PATTERN.test(data.toAccount)) {
    errors.push({
      field: "toAccount",
      message: "toAccount must match format ACC-XXXXX (where X is alphanumeric)",
    });
  }

  if (data.amount === undefined || data.amount === null) {
    errors.push({ field: "amount", message: "amount is required" });
  } else if (typeof data.amount !== "number" || !isFinite(data.amount)) {
    errors.push({ field: "amount", message: "amount must be a positive number with at most 2 decimal places" });
  } else if (data.amount <= 0) {
    errors.push({ field: "amount", message: "amount must be a positive number" });
  } else {
    // Check decimal places: multiply by 100 and verify it's an integer
    const scaled = Math.round(data.amount * 100);
    if (Math.abs(scaled - data.amount * 100) > 1e-9) {
      errors.push({ field: "amount", message: "amount must have at most 2 decimal places" });
    }
  }

  if (data.currency === undefined || data.currency === null || data.currency === "") {
    errors.push({ field: "currency", message: "currency is required" });
  } else if (typeof data.currency !== "string" || !VALID_CURRENCIES.has(data.currency)) {
    errors.push({ field: "currency", message: "currency must be a valid ISO 4217 code" });
  }

  if (data.type === undefined || data.type === null || data.type === "") {
    errors.push({ field: "type", message: "type is required" });
  } else if (typeof data.type !== "string" || !VALID_TYPES.has(data.type as TransactionType)) {
    errors.push({
      field: "type",
      message: "type must be one of: deposit, withdrawal, transfer",
    });
  }

  return errors;
}

/**
 * Validates an account ID format.
 * Returns true if valid, false otherwise.
 */
export function validateAccountId(accountId: string): boolean {
  return ACCOUNT_ID_PATTERN.test(accountId);
}

/**
 * Validates the rate query parameter for interest calculation.
 * Returns true if the value is present and is a positive number.
 */
export function validateRateParam(rate: unknown): boolean {
  if (rate === undefined || rate === null || rate === "") {
    return false;
  }

  const num = typeof rate === "number" ? rate : Number(rate);
  return isFinite(num) && num > 0;
}

/**
 * Validates the days query parameter for interest calculation.
 * Returns true if the value is present and is a positive integer.
 */
export function validateDaysParam(days: unknown): boolean {
  if (days === undefined || days === null || days === "") {
    return false;
  }

  const num = typeof days === "number" ? days : Number(days);
  return isFinite(num) && num > 0 && Number.isInteger(num);
}
