const { v4: uuidv4 } = require('uuid');

const DEFAULT_STATUS = 'completed';

class Transaction {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.fromAccount = data.fromAccount;
    this.toAccount = data.toAccount;
    this.amount = data.amount;
    this.currency = data.currency.toUpperCase();
    this.type = data.type.toLowerCase();
    this.timestamp = data.timestamp || new Date().toISOString();
    this.status = data.status || DEFAULT_STATUS;
  }

  toJSON() {
    return {
      id: this.id,
      fromAccount: this.fromAccount,
      toAccount: this.toAccount,
      amount: this.amount,
      currency: this.currency,
      type: this.type,
      timestamp: this.timestamp,
      status: this.status
    };
  }
}

module.exports = Transaction;
