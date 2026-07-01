import { describe, it, expect } from "vitest";
import { buildErrorResponse, buildNotFoundResponse } from "../../lib/errors";

describe("buildErrorResponse", () => {
  it("returns an object with error message and no details when details are omitted", () => {
    const result = buildErrorResponse("Something went wrong");
    expect(result).toEqual({ error: "Something went wrong" });
    expect(result.details).toBeUndefined();
  });

  it("returns an object with error message and no details when details is an empty array", () => {
    const result = buildErrorResponse("Validation failed", []);
    expect(result).toEqual({ error: "Validation failed" });
    expect(result.details).toBeUndefined();
  });

  it("includes details array when validation errors are provided", () => {
    const details = [
      { field: "amount", message: "Amount must be positive" },
      { field: "currency", message: "Invalid ISO 4217 code" },
    ];
    const result = buildErrorResponse("Validation failed", details);
    expect(result).toEqual({
      error: "Validation failed",
      details,
    });
  });

  it("includes a single detail entry correctly", () => {
    const details = [{ field: "type", message: "Invalid transaction type" }];
    const result = buildErrorResponse("Validation failed", details);
    expect(result).toEqual({
      error: "Validation failed",
      details: [{ field: "type", message: "Invalid transaction type" }],
    });
  });
});

describe("buildNotFoundResponse", () => {
  it("returns a not found error for a transaction", () => {
    const result = buildNotFoundResponse("Transaction", "abc-123");
    expect(result).toEqual({ error: "Transaction not found" });
  });

  it("returns a not found error for an account", () => {
    const result = buildNotFoundResponse("Account", "ACC-12345");
    expect(result).toEqual({ error: "Account not found" });
  });

  it("does not include a details field", () => {
    const result = buildNotFoundResponse("Transaction", "some-id");
    expect(result.details).toBeUndefined();
  });
});
