import { Transaction } from './transaction';

const transactions: Transaction[] = [];

export const getAll = (): Transaction[] => [...transactions];

export const getById = (id: string): Transaction | undefined =>
  transactions.find(t => t.id === id);

export const add = (transaction: Transaction): Transaction => {
  transactions.push(transaction);
  return transaction;
};
