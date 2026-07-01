/**
 * TypeScript types, enums, and interfaces for the Banking Transactions API.
 */

export enum TransactionType {
  DEPOSIT = "deposit",
  WITHDRAWAL = "withdrawal",
  TRANSFER = "transfer",
}

export enum TransactionStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface Transaction {
  id: string; // UUID v4, auto-generated
  fromAccount: string; // Format: ACC-XXXXX (alphanumeric)
  toAccount: string; // Format: ACC-XXXXX (alphanumeric)
  amount: number; // Positive, max 2 decimal places
  currency: string; // ISO 4217 code
  type: TransactionType;
  timestamp: string; // ISO 8601 datetime
  status: TransactionStatus;
}

export interface CreateTransactionInput {
  fromAccount: string;
  toAccount: string;
  amount: number;
  currency: string;
  type: TransactionType;
}

export interface FilterCriteria {
  accountId?: string;
  type?: TransactionType;
  from?: string;
  to?: string;
}

export interface ErrorResponse {
  error: string;
  details?: Array<{ field: string; message: string }>;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface BalanceResponse {
  accountId: string;
  balance: number;
  currency: string;
}

export interface SummaryResponse {
  accountId: string;
  totalDeposits: number;
  totalWithdrawals: number;
  transactionCount: number;
  mostRecentTransactionDate: string | null;
}

export interface InterestResponse {
  accountId: string;
  balance: number;
  rate: number;
  days: number;
  interest: number;
}
