import { describe, it, expect } from "vitest";
import {
  TransactionType,
  TransactionStatus,
  type Transaction,
  type CreateTransactionInput,
  type FilterCriteria,
  type ErrorResponse,
  type ValidationError,
  type BalanceResponse,
  type SummaryResponse,
  type InterestResponse,
} from "@/lib/types";

describe("TransactionType enum", () => {
  it("should have DEPOSIT, WITHDRAWAL, and TRANSFER values", () => {
    expect(TransactionType.DEPOSIT).toBe("deposit");
    expect(TransactionType.WITHDRAWAL).toBe("withdrawal");
    expect(TransactionType.TRANSFER).toBe("transfer");
  });

  it("should have exactly 3 members", () => {
    const values = Object.values(TransactionType);
    expect(values).toHaveLength(3);
  });
});

describe("TransactionStatus enum", () => {
  it("should have PENDING, COMPLETED, and FAILED values", () => {
    expect(TransactionStatus.PENDING).toBe("pending");
    expect(TransactionStatus.COMPLETED).toBe("completed");
    expect(TransactionStatus.FAILED).toBe("failed");
  });

  it("should have exactly 3 members", () => {
    const values = Object.values(TransactionStatus);
    expect(values).toHaveLength(3);
  });
});

describe("Transaction interface", () => {
  it("should allow creating a valid transaction object", () => {
    const transaction: Transaction = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      fromAccount: "ACC-12345",
      toAccount: "ACC-67890",
      amount: 100.5,
      currency: "USD",
      type: TransactionType.TRANSFER,
      timestamp: "2024-01-01T00:00:00.000Z",
      status: TransactionStatus.PENDING,
    };

    expect(transaction.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(transaction.fromAccount).toBe("ACC-12345");
    expect(transaction.toAccount).toBe("ACC-67890");
    expect(transaction.amount).toBe(100.5);
    expect(transaction.currency).toBe("USD");
    expect(transaction.type).toBe(TransactionType.TRANSFER);
    expect(transaction.timestamp).toBe("2024-01-01T00:00:00.000Z");
    expect(transaction.status).toBe(TransactionStatus.PENDING);
  });
});

describe("CreateTransactionInput interface", () => {
  it("should allow creating a valid input object", () => {
    const input: CreateTransactionInput = {
      fromAccount: "ACC-ABCDE",
      toAccount: "ACC-FGHIJ",
      amount: 250.0,
      currency: "EUR",
      type: TransactionType.DEPOSIT,
    };

    expect(input.fromAccount).toBe("ACC-ABCDE");
    expect(input.toAccount).toBe("ACC-FGHIJ");
    expect(input.amount).toBe(250.0);
    expect(input.currency).toBe("EUR");
    expect(input.type).toBe(TransactionType.DEPOSIT);
  });
});

describe("FilterCriteria interface", () => {
  it("should allow all fields to be optional", () => {
    const empty: FilterCriteria = {};
    expect(empty).toEqual({});
  });

  it("should allow partial filter criteria", () => {
    const criteria: FilterCriteria = {
      accountId: "ACC-12345",
      type: TransactionType.WITHDRAWAL,
    };

    expect(criteria.accountId).toBe("ACC-12345");
    expect(criteria.type).toBe(TransactionType.WITHDRAWAL);
    expect(criteria.from).toBeUndefined();
    expect(criteria.to).toBeUndefined();
  });
});

describe("ErrorResponse interface", () => {
  it("should allow error without details", () => {
    const error: ErrorResponse = {
      error: "Something went wrong",
    };

    expect(error.error).toBe("Something went wrong");
    expect(error.details).toBeUndefined();
  });

  it("should allow error with validation details", () => {
    const error: ErrorResponse = {
      error: "Validation failed",
      details: [
        { field: "amount", message: "Amount must be positive" },
        { field: "currency", message: "Invalid currency code" },
      ],
    };

    expect(error.details).toHaveLength(2);
    expect(error.details![0].field).toBe("amount");
  });
});

describe("ValidationError interface", () => {
  it("should have field and message properties", () => {
    const validationError: ValidationError = {
      field: "amount",
      message: "Amount must be positive",
    };

    expect(validationError.field).toBe("amount");
    expect(validationError.message).toBe("Amount must be positive");
  });
});

describe("BalanceResponse interface", () => {
  it("should contain accountId, balance, and currency", () => {
    const response: BalanceResponse = {
      accountId: "ACC-12345",
      balance: 1500.75,
      currency: "USD",
    };

    expect(response.accountId).toBe("ACC-12345");
    expect(response.balance).toBe(1500.75);
    expect(response.currency).toBe("USD");
  });
});

describe("SummaryResponse interface", () => {
  it("should contain all summary fields with a date", () => {
    const response: SummaryResponse = {
      accountId: "ACC-12345",
      totalDeposits: 5000,
      totalWithdrawals: 2000,
      transactionCount: 10,
      mostRecentTransactionDate: "2024-06-15T10:30:00.000Z",
    };

    expect(response.totalDeposits).toBe(5000);
    expect(response.totalWithdrawals).toBe(2000);
    expect(response.transactionCount).toBe(10);
    expect(response.mostRecentTransactionDate).toBe(
      "2024-06-15T10:30:00.000Z"
    );
  });

  it("should allow null for mostRecentTransactionDate", () => {
    const response: SummaryResponse = {
      accountId: "ACC-12345",
      totalDeposits: 0,
      totalWithdrawals: 0,
      transactionCount: 0,
      mostRecentTransactionDate: null,
    };

    expect(response.mostRecentTransactionDate).toBeNull();
  });
});

describe("InterestResponse interface", () => {
  it("should contain all interest calculation fields", () => {
    const response: InterestResponse = {
      accountId: "ACC-12345",
      balance: 10000,
      rate: 0.05,
      days: 30,
      interest: 41.1,
    };

    expect(response.accountId).toBe("ACC-12345");
    expect(response.balance).toBe(10000);
    expect(response.rate).toBe(0.05);
    expect(response.days).toBe(30);
    expect(response.interest).toBe(41.1);
  });
});
