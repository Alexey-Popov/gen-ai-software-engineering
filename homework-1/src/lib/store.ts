/**
 * Transaction Store - singleton in-memory store for banking transactions.
 */

import { v4 as uuidv4 } from "uuid";
import {
  Transaction,
  CreateTransactionInput,
  FilterCriteria,
  TransactionStatus,
} from "./types";

const store: Map<string, Transaction> = new Map();

/**
 * Create a new transaction from input data.
 * Auto-generates UUID, sets timestamp to current ISO 8601, sets status to PENDING.
 */
export function create(input: CreateTransactionInput): Transaction {
  const transaction: Transaction = {
    id: uuidv4(),
    fromAccount: input.fromAccount,
    toAccount: input.toAccount,
    amount: input.amount,
    currency: input.currency,
    type: input.type,
    timestamp: new Date().toISOString(),
    status: TransactionStatus.PENDING,
  };

  store.set(transaction.id, transaction);
  return transaction;
}

/**
 * Get a transaction by its ID.
 */
export function getById(id: string): Transaction | undefined {
  return store.get(id);
}

/**
 * Get all transactions in the store.
 */
export function getAll(): Transaction[] {
  return Array.from(store.values());
}

/**
 * Filter transactions based on criteria.
 * Supports accountId (matches fromAccount OR toAccount), type, and date range (from/to).
 * All provided filters are combined with AND logic.
 */
export function filter(criteria: FilterCriteria): Transaction[] {
  let results = getAll();

  if (criteria.accountId) {
    const accountId = criteria.accountId;
    results = results.filter(
      (t) => t.fromAccount === accountId || t.toAccount === accountId
    );
  }

  if (criteria.type) {
    const type = criteria.type;
    results = results.filter((t) => t.type === type);
  }

  if (criteria.from) {
    const fromDate = new Date(criteria.from).getTime();
    results = results.filter((t) => new Date(t.timestamp).getTime() >= fromDate);
  }

  if (criteria.to) {
    const toDate = new Date(criteria.to).getTime();
    results = results.filter((t) => new Date(t.timestamp).getTime() <= toDate);
  }

  return results;
}

/**
 * Reset the store (clear all transactions). Used for testing purposes.
 */
export function reset(): void {
  store.clear();
}
