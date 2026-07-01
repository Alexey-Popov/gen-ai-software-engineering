import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from './entities/transaction.entity';

/** Rounds a monetary amount to 2 decimal places, avoiding float drift. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class TransactionsService {
  // In-memory storage — resets on every restart. No database required (per spec).
  private readonly transactions: Transaction[] = [];

  create(dto: CreateTransactionDto): Transaction {
    const transaction: Transaction = {
      id: randomUUID(),
      fromAccount: dto.fromAccount ?? null,
      toAccount: dto.toAccount ?? null,
      amount: dto.amount,
      currency: dto.currency.toUpperCase(),
      type: dto.type,
      timestamp: new Date().toISOString(),
      status: dto.status ?? TransactionStatus.COMPLETED,
    };
    this.transactions.push(transaction);
    return transaction;
  }

  findAll(filter: QueryTransactionsDto = {}): Transaction[] {
    const fromTs = filter.from ? new Date(filter.from).getTime() : null;
    // Treat an inclusive end date without a time component as the end of that day.
    const toTs = filter.to ? endOfRange(filter.to) : null;

    return this.transactions.filter((t) => {
      if (
        filter.accountId &&
        t.fromAccount !== filter.accountId &&
        t.toAccount !== filter.accountId
      ) {
        return false;
      }
      if (filter.type && t.type !== filter.type) return false;

      const ts = new Date(t.timestamp).getTime();
      if (fromTs != null && ts < fromTs) return false;
      if (toTs != null && ts > toTs) return false;

      return true;
    });
  }

  findOne(id: string): Transaction {
    const transaction = this.transactions.find((t) => t.id === id);
    if (!transaction) {
      throw new NotFoundException(`Transaction with id "${id}" not found`);
    }
    return transaction;
  }

  /**
   * Current balance of an account, derived from completed transactions only:
   * incoming deposits/transfers add, outgoing withdrawals/transfers subtract.
   */
  getBalance(accountId: string): number {
    let balance = 0;
    for (const t of this.transactions) {
      if (t.status !== TransactionStatus.COMPLETED) continue;

      const incoming =
        t.toAccount === accountId &&
        (t.type === TransactionType.DEPOSIT || t.type === TransactionType.TRANSFER);
      const outgoing =
        t.fromAccount === accountId &&
        (t.type === TransactionType.WITHDRAWAL || t.type === TransactionType.TRANSFER);

      if (incoming) balance += t.amount;
      if (outgoing) balance -= t.amount;
    }
    return round2(balance);
  }

  /** Aggregated activity for an account (Task 4A). */
  getSummary(accountId: string) {
    const related = this.transactions.filter(
      (t) => t.fromAccount === accountId || t.toAccount === accountId,
    );

    const totalDeposits = round2(
      related
        .filter((t) => t.type === TransactionType.DEPOSIT && t.toAccount === accountId)
        .reduce((sum, t) => sum + t.amount, 0),
    );
    const totalWithdrawals = round2(
      related
        .filter((t) => t.type === TransactionType.WITHDRAWAL && t.fromAccount === accountId)
        .reduce((sum, t) => sum + t.amount, 0),
    );

    const mostRecent = related.reduce<string | null>(
      (latest, t) => (latest === null || t.timestamp > latest ? t.timestamp : latest),
      null,
    );

    return {
      accountId,
      totalDeposits,
      totalWithdrawals,
      transactionCount: related.length,
      mostRecentTransactionDate: mostRecent,
      currentBalance: this.getBalance(accountId),
    };
  }

  /** Simple interest on the current balance: principal * rate * days / 365 (Task 4B). */
  calculateInterest(accountId: string, rate: number, days: number) {
    const principal = this.getBalance(accountId);
    const interest = round2((principal * rate * days) / 365);
    return {
      accountId,
      principal,
      rate,
      days,
      interest,
      total: round2(principal + interest),
    };
  }
}

/** Converts a date-range upper bound into an inclusive end-of-day timestamp when needed. */
function endOfRange(value: string): number {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
  const date = new Date(value);
  if (dateOnly) {
    date.setHours(23, 59, 59, 999);
  }
  return date.getTime();
}
