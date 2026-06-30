'use strict';

/**
 * Curated allowlist of ISO 4217 currency codes.
 *
 * This is a documented SUBSET of the full ISO 4217 standard (~180 codes) —
 * the most commonly used currencies. Extend this set as needed; it is the
 * single source of truth for currency validation.
 */
const ALLOWED_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD',
  'CNY', 'HKD', 'SGD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK',
  'HUF', 'UAH', 'TRY', 'INR', 'BRL', 'ZAR', 'MXN', 'AED',
]);

/**
 * @param {unknown} code
 * @returns {boolean} true if `code` is an allowed ISO 4217 currency code
 */
function isValidCurrency(code) {
  return typeof code === 'string' && ALLOWED_CURRENCIES.has(code);
}

module.exports = { ALLOWED_CURRENCIES, isValidCurrency };
