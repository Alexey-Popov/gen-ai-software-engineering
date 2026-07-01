const transactions = [];

export const transactionRepository = {
  getAll() {
    return transactions;
  },

  findById(id) {
    return transactions.find((t) => t.id === id) ?? null;
  },

  create(transaction) {
    transactions.push(transaction);
    return transaction;
  },

  query({ accountId, type, from, to } = {}) {
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(new Date(to).setHours(23, 59, 59, 999)) : null;
    return transactions.filter((t) => {
      if (accountId && t.fromAccount !== accountId && t.toAccount !== accountId) return false;
      if (type && t.type !== type) return false;
      const ts = new Date(t.timestamp);
      if (fromDate && ts < fromDate) return false;
      if (toDate && ts > toDate) return false;
      return true;
    });
  },
};
