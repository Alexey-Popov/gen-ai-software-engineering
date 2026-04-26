// Common ISO 4217 currency codes accepted by the API.
// Keep the list compact — extend as needed.
export const SUPPORTED_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD',
  'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF',
  'UAH', 'RON', 'BGN', 'TRY', 'CNY', 'HKD', 'SGD',
  'INR', 'KRW', 'ZAR', 'MXN', 'BRL', 'ILS', 'AED',
]);

export function isSupportedCurrency(code) {
  return typeof code === 'string' && SUPPORTED_CURRENCIES.has(code.toUpperCase());
}
