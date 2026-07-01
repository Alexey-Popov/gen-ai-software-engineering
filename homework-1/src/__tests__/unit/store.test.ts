import { describe, it, expect, beforeEach } from "vitest";
import { create, getById, getAll, filter, reset } from "@/lib/store";
import {
  TransactionType,
  TransactionStatus,
  CreateTransactionInput,
} from "@/lib/types";

describe("Transaction Store", () => {
  beforeEach(() => {
    reset();
  });

  describe("create()", () => {
    it("should create a transaction with auto-generated UUID", () => {
      const input: CreateTransactionInput = {
        fromAccount: "ACC-12345",
        toAccount: "ACC-67890",
        amount: 100.5,
        currency: "USD",
        type: TransactionType.TRANSFER,
      };

      const result = create(input);

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("should set timestamp to ISO 8601 format", () => {
      const input: CreateTransactionInput = {
        fromAccount: "ACC-12345",
        toAccount: "ACC-67890",
        amount: 50,
        currency: "EUR",
        type: TransactionType.DEPOSIT,
      };

      const result = create(input);

      // ISO 8601 datetime string should be parseable
      const parsed = new Date(result.timestamp);
      expect(parsed.toISOString()).toBe(result.timestamp);
    });

    it("should set status to PENDING", () => {
      const input: CreateTransactionInput = {
        fromAccount: "ACC-AAAAA",
        toAccount: "ACC-BBBBB",
        amount: 200,
        currency: "GBP",
        type: TransactionType.WITHDRAWAL,
      };

      const result = create(input);

      expect(result.status).toBe(TransactionStatus.PENDING);
    });

    it("should preserve all input fields unchanged", () => {
      const input: CreateTransactionInput = {
        fromAccount: "ACC-11111",
        toAccount: "ACC-22222",
        amount: 99.99,
        currency: "JPY",
        type: TransactionType.TRANSFER,
      };

      const result = create(input);

      expect(result.fromAccount).toBe(input.fromAccount);
      expect(result.toAccount).toBe(input.toAccount);
      expect(result.amount).toBe(input.amount);
      expect(result.currency).toBe(input.currency);
      expect(result.type).toBe(input.type);
    });

    it("should store the transaction in the store", () => {
      const input: CreateTransactionInput = {
        fromAccount: "ACC-STORE",
        toAccount: "ACC-CHECK",
        amount: 10,
        currency: "USD",
        type: TransactionType.DEPOSIT,
      };

      const result = create(input);
      const retrieved = getById(result.id);

      expect(retrieved).toEqual(result);
    });
  });

  describe("getById()", () => {
    it("should return the transaction when it exists", () => {
      const input: CreateTransactionInput = {
        fromAccount: "ACC-AAAAA",
        toAccount: "ACC-BBBBB",
        amount: 75,
        currency: "USD",
        type: TransactionType.DEPOSIT,
      };

      const created = create(input);
      const result = getById(created.id);

      expect(result).toEqual(created);
    });

    it("should return undefined for non-existent ID", () => {
      const result = getById("non-existent-id");

      expect(result).toBeUndefined();
    });
  });

  describe("getAll()", () => {
    it("should return empty array when store is empty", () => {
      const result = getAll();

      expect(result).toEqual([]);
    });

    it("should return all stored transactions", () => {
      const input1: CreateTransactionInput = {
        fromAccount: "ACC-11111",
        toAccount: "ACC-22222",
        amount: 100,
        currency: "USD",
        type: TransactionType.DEPOSIT,
      };
      const input2: CreateTransactionInput = {
        fromAccount: "ACC-33333",
        toAccount: "ACC-44444",
        amount: 200,
        currency: "EUR",
        type: TransactionType.WITHDRAWAL,
      };

      const t1 = create(input1);
      const t2 = create(input2);
      const result = getAll();

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(t1);
      expect(result).toContainEqual(t2);
    });
  });

  describe("filter()", () => {
    const setupTransactions = () => {
      // Create a few transactions for filtering tests
      const t1 = create({
        fromAccount: "ACC-AAAAA",
        toAccount: "ACC-BBBBB",
        amount: 100,
        currency: "USD",
        type: TransactionType.DEPOSIT,
      });
      const t2 = create({
        fromAccount: "ACC-CCCCC",
        toAccount: "ACC-AAAAA",
        amount: 200,
        currency: "EUR",
        type: TransactionType.TRANSFER,
      });
      const t3 = create({
        fromAccount: "ACC-DDDDD",
        toAccount: "ACC-EEEEE",
        amount: 300,
        currency: "USD",
        type: TransactionType.WITHDRAWAL,
      });
      return { t1, t2, t3 };
    };

    it("should return all transactions when no filters provided", () => {
      const { t1, t2, t3 } = setupTransactions();
      const result = filter({});

      expect(result).toHaveLength(3);
      expect(result).toContainEqual(t1);
      expect(result).toContainEqual(t2);
      expect(result).toContainEqual(t3);
    });

    it("should filter by accountId matching fromAccount", () => {
      const { t1 } = setupTransactions();
      const result = filter({ accountId: "ACC-AAAAA" });

      // ACC-AAAAA is fromAccount in t1, toAccount in t2
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(t1);
    });

    it("should filter by accountId matching toAccount", () => {
      const { t2 } = setupTransactions();
      const result = filter({ accountId: "ACC-AAAAA" });

      expect(result).toContainEqual(t2);
    });

    it("should filter by type", () => {
      const { t3 } = setupTransactions();
      const result = filter({ type: TransactionType.WITHDRAWAL });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(t3);
    });

    it("should filter by date range (from)", () => {
      setupTransactions();
      // All transactions were just created, so use a past date to include all
      const pastDate = new Date(Date.now() - 60000).toISOString();
      const result = filter({ from: pastDate });

      expect(result).toHaveLength(3);
    });

    it("should filter by date range (to)", () => {
      setupTransactions();
      // Use a past date to exclude all transactions created just now
      const pastDate = new Date(Date.now() - 60000).toISOString();
      const result = filter({ to: pastDate });

      expect(result).toHaveLength(0);
    });

    it("should combine filters with AND logic", () => {
      const { t1 } = setupTransactions();
      const result = filter({
        accountId: "ACC-AAAAA",
        type: TransactionType.DEPOSIT,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(t1);
    });

    it("should return empty array when no transactions match", () => {
      setupTransactions();
      const result = filter({ accountId: "ACC-ZZZZZ" });

      expect(result).toHaveLength(0);
    });
  });

  describe("reset()", () => {
    it("should clear all transactions from the store", () => {
      create({
        fromAccount: "ACC-11111",
        toAccount: "ACC-22222",
        amount: 100,
        currency: "USD",
        type: TransactionType.DEPOSIT,
      });

      expect(getAll()).toHaveLength(1);

      reset();

      expect(getAll()).toHaveLength(0);
    });
  });
});
