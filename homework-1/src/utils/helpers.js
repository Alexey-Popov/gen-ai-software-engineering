export function err(field, message) {
  return { field, message };
}

export function hasMaxTwoDecimals(value) {
  return Number.isFinite(value) && Math.round(value * 100) === value * 100;
}

export function computeBalance(accountId, txList) {
  const balances = {};
  for (const { currency, amount, type, fromAccount, toAccount } of txList) {
    if (!balances[currency]) balances[currency] = 0;
    if (type === 'deposit' && toAccount === accountId) {
      balances[currency] += amount;
    } else if (type === 'withdrawal' && fromAccount === accountId) {
      balances[currency] -= amount;
    } else if (type === 'transfer') {
      if (toAccount === accountId) balances[currency] += amount;
      if (fromAccount === accountId) balances[currency] -= amount;
    }
  }
  for (const key of Object.keys(balances)) {
    balances[key] = parseFloat(balances[key].toFixed(2));
  }
  return balances;
}

export function addToTotal(totals, currency, amount) {
  if (!totals[currency]) totals[currency] = 0;
  totals[currency] = parseFloat((totals[currency] + amount).toFixed(2));
}

export const CSV_FIELDS = ['id', 'fromAccount', 'toAccount', 'amount', 'currency', 'type', 'timestamp', 'status'];

export function escapeCSV(value) {
  const str = value === null || value === undefined ? '' : String(value);
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}
