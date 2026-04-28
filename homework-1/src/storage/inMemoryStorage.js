/**
 * Converts a date to end-of-day (23:59:59.999) to ensure inclusive date filtering.
 * Without this, transactions occurring ON the 'to' date would be excluded from date range queries.
 * @param {string|Date} date - The date to convert
 * @returns {Date} Date set to 23:59:59.999
 */
const getEndOfDay = (date) => {
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);
  return endDate;
};

class InMemoryStorage {
  constructor() {
    this.transactions = [];
  }

  addTransaction = (transaction) => {
    this.transactions.push(transaction);
    return transaction;
  };

  getAllTransactions = () => this.transactions;

  getTransactionById = (id) => this.transactions.find(t => t.id === id) || null;

  getFilteredTransactions = (filters) => {
    return this.transactions.filter(t => {
      if (filters.accountId && t.fromAccount !== filters.accountId && t.toAccount !== filters.accountId) {
        return false;
      }
      if (filters.type && t.type !== filters.type) return false;

      // Validate transaction timestamp before date comparisons
      const transactionDate = new Date(t.timestamp);
      if (isNaN(transactionDate.getTime())) {
        console.error(`Invalid timestamp in transaction ${t.id}: ${t.timestamp}`);
        return false;
      }

      if (filters.from && transactionDate < new Date(filters.from)) return false;
      return !(filters.to && transactionDate > getEndOfDay(filters.to));

    });
  };
}

module.exports = new InMemoryStorage();
