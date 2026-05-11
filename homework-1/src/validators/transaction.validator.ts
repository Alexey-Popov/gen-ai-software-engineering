import { CreateTransactionInput } from '../models/transaction';

const VALID_TYPES = ['deposit', 'withdrawal', 'transfer'] as const;

// ACC- followed by exactly 5 alphanumeric characters
const ACCOUNT_FORMAT = /^ACC-[A-Za-z0-9]{5}$/;

// Active ISO 4217 alphabetic currency codes
const ISO_4217_CODES = new Set([
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP',
  'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD',
  'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR',
  'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF',
  'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL',
  'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR',
  'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR',
  'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR',
  'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD',
  'SHP', 'SLL', 'SOS', 'SRD', 'STN', 'SVC', 'SYP', 'SZL', 'THB', 'TJS',
  'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD',
  'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF', 'XPF',
  'YER', 'ZAR', 'ZMW', 'ZWL',
]);

export interface ValidationError {
  field: string;
  message: string;
}

const isAtMostTwoDecimals = (n: number): boolean =>
  parseFloat(n.toFixed(2)) === n;

export const validateTransaction = (
  data: unknown
): { errors: ValidationError[]; input?: CreateTransactionInput } => {
  if (typeof data !== 'object' || data === null) {
    return { errors: [{ field: 'body', message: 'Request body must be an object' }] };
  }

  const body = data as Record<string, unknown>;
  const errors: ValidationError[] = [];

  if (typeof body.fromAccount !== 'string' || !ACCOUNT_FORMAT.test(body.fromAccount)) {
    errors.push({ field: 'fromAccount', message: 'Account number must follow format ACC-XXXXX (e.g. ACC-A1B2C)' });
  }

  if (typeof body.toAccount !== 'string' || !ACCOUNT_FORMAT.test(body.toAccount)) {
    errors.push({ field: 'toAccount', message: 'Account number must follow format ACC-XXXXX (e.g. ACC-A1B2C)' });
  }

  if (typeof body.amount !== 'number' || !isFinite(body.amount) || body.amount <= 0) {
    errors.push({ field: 'amount', message: 'Amount must be a positive number' });
  } else if (!isAtMostTwoDecimals(body.amount)) {
    errors.push({ field: 'amount', message: 'Amount must have at most 2 decimal places' });
  }

  if (typeof body.currency !== 'string' || !ISO_4217_CODES.has(body.currency.toUpperCase())) {
    errors.push({ field: 'currency', message: 'Invalid currency code. Must be a valid ISO 4217 code (e.g. USD, EUR, GBP)' });
  }

  if (!VALID_TYPES.includes(body.type as never)) {
    errors.push({ field: 'type', message: `Transaction type must be one of: ${VALID_TYPES.join(', ')}` });
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    errors: [],
    input: {
      fromAccount: body.fromAccount as string,
      toAccount: body.toAccount as string,
      amount: body.amount as number,
      currency: (body.currency as string).toUpperCase(),
      type: body.type as CreateTransactionInput['type'],
    },
  };
};
