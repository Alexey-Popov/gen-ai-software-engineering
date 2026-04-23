class InMemoryStorage {
  constructor() {
    this.transactions = [];
  }

  addTransaction(transaction) {
    this.transactions.push(transaction);
    return transaction;
  }

  getAllTransactions() {
    return this.transactions;
  }

  getTransactionById(id) {
    return this.transactions.find(t => t.id === id) || null;
  }

  getFilteredTransactions(filters) {
    let result = [...this.transactions];

    if (filters.accountId) {
      result = result.filter(t =>
        t.fromAccount === filters.accountId || t.toAccount === filters.accountId
      );
    }

    if (filters.type) {
      result = result.filter(t => t.type === filters.type);
    }

    if (filters.from) {
      const fromDate = new Date(filters.from);
      result = result.filter(t => new Date(t.timestamp) >= fromDate);
    }

    if (filters.to) {
      const toDate = new Date(filters.to);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(t => new Date(t.timestamp) <= toDate);
    }

    return result;
  }
}

module.exports = new InMemoryStorage();
