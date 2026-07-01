export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  TRANSFER = 'transfer',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Shape of a persisted transaction. Storage is in-memory (see TransactionsService),
 * so this is a plain interface rather than an ORM entity.
 */
export interface Transaction {
  id: string;
  fromAccount: string | null;
  toAccount: string | null;
  amount: number;
  currency: string;
  type: TransactionType;
  timestamp: string; // ISO 8601
  status: TransactionStatus;
}
