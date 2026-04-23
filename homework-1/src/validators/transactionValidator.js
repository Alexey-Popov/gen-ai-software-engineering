const VALID_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD',
  'CNY', 'INR', 'BRL', 'ZAR', 'MXN', 'SGD', 'HKD', 'SEK',
  'NOK', 'DKK', 'PLN', 'THB', 'IDR', 'MYR', 'PHP', 'CZK'
];
const VALID_TYPES = ['deposit', 'withdrawal', 'transfer'];

const isValidAccountId = (accountId) => accountId && /^ACC-[A-Z0-9]{5}$/i.test(accountId);

const isValidAmount = (amount) =>
  Number.isFinite(amount) && amount > 0 && (amount.toString().split('.')[1] || '').length <= 2;

const isValidCurrency = (currency) => currency && VALID_CURRENCIES.includes(String(currency).toUpperCase());

const isValidType = (type) => type && VALID_TYPES.includes(String(type).toLowerCase());

/**
 * Schema-based validation pattern for transaction objects.
 * Benefits:
 * - Declarative: Rules are defined separately from validation logic
 * - Maintainable: Adding new fields only requires updating this schema
 * - Consistent: All fields are validated the same way
 * - Self-documenting: Schema serves as documentation for transaction structure
 */
const TRANSACTION_SCHEMA = {
  fromAccount: {
    required: true,
    validator: isValidAccountId,
    messages: {
      required: 'fromAccount is required',
      invalid: 'fromAccount must follow format ACC-XXXXX (e.g., ACC-12345)'
    }
  },
  toAccount: {
    required: true,
    validator: isValidAccountId,
    messages: {
      required: 'toAccount is required',
      invalid: 'toAccount must follow format ACC-XXXXX (e.g., ACC-67890)'
    }
  },
  amount: {
    required: true,
    validator: isValidAmount,
    messages: {
      required: 'amount is required',
      invalid: 'amount must be a positive number with maximum 2 decimal places'
    }
  },
  currency: {
    required: true,
    validator: isValidCurrency,
    messages: {
      required: 'currency is required',
      invalid: (value) => `currency must be a valid ISO 4217 code. Received: ${value}`
    }
  },
  type: {
    required: true,
    validator: isValidType,
    messages: {
      required: 'type is required',
      invalid: 'type must be one of: deposit, withdrawal, transfer'
    }
  }
};

/**
 * Validates a transaction object against the defined schema.
 * Checks all required fields, formats, and business rules.
 *
 * @param {Object} transaction - The transaction object to validate
 * @returns {Object} Validation result with shape: { isValid: boolean, errors: Array }
 */
const validateTransaction = (transaction) => {
  if (!transaction) {
    return { isValid: false, errors: [{ field: 'transaction', message: 'Transaction data is required' }] };
  }

  const errors = [];

  // Validate each field according to schema
  for (const [field, rules] of Object.entries(TRANSACTION_SCHEMA)) {
    const value = transaction[field];

    // Check for missing required fields (explicit null/undefined check)
    if (value === undefined || value === null) {
      if (rules.required) {
        errors.push({ field, message: rules.messages.required });
      }
      continue;
    }

    // For non-null values, check if they pass validation
    // Empty strings will fail validation naturally through their validators
    if (!rules.validator(value)) {
      const message = typeof rules.messages.invalid === 'function'
        ? rules.messages.invalid(value)
        : rules.messages.invalid;
      errors.push({ field, message });
    }
  }

  return { isValid: errors.length === 0, errors };
};

// Strict ISO 8601 date validation (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;

const isValidDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return false;
  // Check format matches ISO 8601
  if (!ISO_8601_REGEX.test(dateStr)) return false;
  // Check that date is actually valid (not like 2024-13-45)
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
};

module.exports = {
  validateTransaction,
  isValidAccountId,
  isValidDate
};
