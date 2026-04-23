const VALID_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD',
  'CNY', 'INR', 'BRL', 'ZAR', 'MXN', 'SGD', 'HKD', 'SEK',
  'NOK', 'DKK', 'PLN', 'THB', 'IDR', 'MYR', 'PHP', 'CZK'
];

const VALID_TYPES = ['deposit', 'withdrawal', 'transfer'];

function isValidAccountId(accountId) {
  return accountId && typeof accountId === 'string' && /^ACC-[A-Z0-9]{5}$/i.test(accountId);
}

function isValidAmount(amount) {
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    return false;
  }
  const decimalPlaces = (amount.toString().split('.')[1] || '').length;
  return decimalPlaces <= 2;
}

function isValidCurrency(currency) {
  return currency && typeof currency === 'string' && VALID_CURRENCIES.includes(currency.toUpperCase());
}

function isValidType(type) {
  return type && typeof type === 'string' && VALID_TYPES.includes(type.toLowerCase());
}

function validateTransaction(transaction) {
  const errors = [];

  if (!transaction) {
    return { isValid: false, errors: [{ field: 'transaction', message: 'Transaction data is required' }] };
  }

  if (!transaction.fromAccount) {
    errors.push({ field: 'fromAccount', message: 'fromAccount is required' });
  } else if (!isValidAccountId(transaction.fromAccount)) {
    errors.push({ field: 'fromAccount', message: 'fromAccount must follow format ACC-XXXXX (e.g., ACC-12345)' });
  }

  if (!transaction.toAccount) {
    errors.push({ field: 'toAccount', message: 'toAccount is required' });
  } else if (!isValidAccountId(transaction.toAccount)) {
    errors.push({ field: 'toAccount', message: 'toAccount must follow format ACC-XXXXX (e.g., ACC-67890)' });
  }

  if (transaction.amount === undefined || transaction.amount === null) {
    errors.push({ field: 'amount', message: 'amount is required' });
  } else if (!isValidAmount(transaction.amount)) {
    errors.push({ field: 'amount', message: 'amount must be a positive number with maximum 2 decimal places' });
  }

  if (!transaction.currency) {
    errors.push({ field: 'currency', message: 'currency is required' });
  } else if (!isValidCurrency(transaction.currency)) {
    errors.push({ field: 'currency', message: `currency must be a valid ISO 4217 code. Received: ${transaction.currency}` });
  }

  if (!transaction.type) {
    errors.push({ field: 'type', message: 'type is required' });
  } else if (!isValidType(transaction.type)) {
    errors.push({ field: 'type', message: 'type must be one of: deposit, withdrawal, transfer' });
  }

  return { isValid: errors.length === 0, errors };
}

function isValidDate(dateStr) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return !isNaN(date);
}

module.exports = {
  validateTransaction,
  isValidAccountId,
  isValidDate
};
