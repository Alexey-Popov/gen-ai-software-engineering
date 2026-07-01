const API = 'http://localhost:3000';
const $ = (id) => document.getElementById(id);

function toast(text, kind = 'info') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = text;
  $('toaster').appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

async function api(path, options) {
  const res = await fetch(API + path, options);
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

const money = (n) => Number(n).toFixed(2);
const shortId = (id) => (id || '').slice(0, 8) + '…';
const fmtDate = (s) => (s ? new Date(s).toLocaleString() : '—');

// ---- Navigation ----
function showView(name) {
  for (const v of ['transactions', 'new', 'accounts']) {
    $('view-' + v).hidden = v !== name;
  }
  document.querySelectorAll('.nav a').forEach((a) =>
    a.classList.toggle('active', a.dataset.view === name)
  );
}
document.querySelectorAll('[data-view]').forEach((el) =>
  el.addEventListener('click', () => showView(el.dataset.view))
);

// ---- Theme ----
$('themeBtn').addEventListener('click', () => {
  const html = document.documentElement;
  const dark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', dark ? 'light' : 'dark');
  $('themeBtn').textContent = dark ? '☾ Dark' : '☀ Light';
});

// ---- Health chip ----
async function checkHealth() {
  const chip = $('apiChip');
  try {
    const r = await api('/actuator/health');
    if (r.ok && r.data && r.data.status === 'UP') {
      chip.className = 'chip on'; chip.textContent = 'API online';
    } else { chip.className = 'chip off'; chip.textContent = 'API offline'; }
  } catch { chip.className = 'chip off'; chip.textContent = 'API offline'; }
}

// ---- Transactions ----
function renderTransactions(list) {
  if (!Array.isArray(list) || list.length === 0) {
    $('txTable').innerHTML = '<div class="empty">No transactions found.</div>';
    return;
  }
  const rows = list.map((t) => `
    <tr>
      <td>${shortId(t.id)}</td>
      <td>${t.fromAccount}</td>
      <td>${t.toAccount}</td>
      <td>${money(t.amount)} ${t.currency}</td>
      <td class="cap">${t.type}</td>
      <td><span class="badge ${t.status}">${t.status}</span></td>
      <td class="muted">${fmtDate(t.timestamp)}</td>
    </tr>`).join('');
  $('txTable').innerHTML = `
    <table>
      <thead><tr><th>ID</th><th>From</th><th>To</th><th>Amount</th><th>Type</th><th>Status</th><th>Date</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

async function loadTransactions() {
  const params = new URLSearchParams();
  if ($('fAccount').value) params.set('accountId', $('fAccount').value);
  if ($('fType').value) params.set('type', $('fType').value);
  if ($('fFrom').value) params.set('from', $('fFrom').value);
  if ($('fTo').value) params.set('to', $('fTo').value);
  const q = params.toString();
  const r = await api('/transactions' + (q ? '?' + q : ''));
  if (r.ok) renderTransactions(r.data);
  else $('txTable').innerHTML = '<div class="empty">Could not load transactions. Is the API running on :3000?</div>';
}

$('applyBtn').addEventListener('click', loadTransactions);
$('clearBtn').addEventListener('click', () => {
  $('fAccount').value = ''; $('fType').value = ''; $('fFrom').value = ''; $('fTo').value = '';
  loadTransactions();
});

$('exportBtn').addEventListener('click', async () => {
  try {
    const res = await fetch(API + '/transactions/export?format=csv');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'transactions.csv'; a.click();
    URL.revokeObjectURL(url);
  } catch { toast('Export failed.', 'error'); }
});

// ---- Create ----
function clearErrors() {
  ['eFrom', 'eTo', 'eAmount', 'eCurrency', 'eType'].forEach((id) => ($(id).textContent = ''));
}
const errFieldMap = { fromAccount: 'eFrom', toAccount: 'eTo', amount: 'eAmount', currency: 'eCurrency', type: 'eType' };

$('createBtn').addEventListener('click', async () => {
  clearErrors();
  const body = {
    fromAccount: $('nFrom').value,
    toAccount: $('nTo').value,
    amount: parseFloat($('nAmount').value),
    currency: $('nCurrency').value,
    type: $('nType').value,
  };
  const r = await api('/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (r.status === 201) {
    toast('Transaction created.', 'success');
    ['nFrom', 'nTo', 'nAmount'].forEach((id) => ($(id).value = ''));
    showView('transactions');
    loadTransactions();
  } else if (r.status === 400 && r.data && Array.isArray(r.data.details)) {
    for (const d of r.data.details) {
      const el = $(errFieldMap[d.field]);
      if (el) el.textContent = d.message;
    }
  } else {
    toast('Could not create transaction.', 'error');
  }
});

// ---- Account tools ----
$('balanceBtn').addEventListener('click', async () => {
  const acc = $('bAccount').value;
  if (!acc) return;
  const r = await api(`/accounts/${acc}/balance`);
  if (r.ok) {
    $('balanceOut').hidden = false;
    $('balanceOut').innerHTML = `<div class="muted">${r.data.accountId}</div><div class="value">${money(r.data.balance)}</div>`;
  } else toast('Could not load balance.', 'error');
});

$('summaryBtn').addEventListener('click', async () => {
  const acc = $('sAccount').value;
  if (!acc) return;
  const r = await api(`/accounts/${acc}/summary`);
  if (r.ok) {
    const s = r.data;
    $('summaryOut').hidden = false;
    $('summaryOut').innerHTML = `
      <div class="stat"><div class="muted">Total deposits</div><div class="value">${money(s.totalDeposits)}</div></div>
      <div class="stat"><div class="muted">Total withdrawals</div><div class="value">${money(s.totalWithdrawals)}</div></div>
      <div class="stat"><div class="muted">Transactions</div><div class="value">${s.transactionCount}</div></div>
      <div class="stat"><div class="muted">Most recent</div><div class="value" style="font-size:16px">${s.mostRecentTransactionDate ? fmtDate(s.mostRecentTransactionDate) : '—'}</div></div>`;
  } else toast('Could not load summary.', 'error');
});

$('interestBtn').addEventListener('click', async () => {
  const acc = $('iAccount').value;
  if (!acc) return;
  const r = await api(`/accounts/${acc}/interest?rate=${$('iRate').value}&days=${$('iDays').value}`);
  if (r.ok) {
    const i = r.data;
    $('interestOut').hidden = false;
    $('interestOut').innerHTML = `
      <div class="stat"><div class="muted">Balance</div><div class="value">${money(i.balance)}</div></div>
      <div class="stat"><div class="muted">Rate</div><div class="value">${i.rate}</div></div>
      <div class="stat"><div class="muted">Days</div><div class="value">${i.days}</div></div>
      <div class="stat"><div class="muted">Interest</div><div class="value">${money(i.interest)}</div></div>`;
  } else toast('Could not calculate interest (check rate and days).', 'error');
});

// ---- Init ----
checkHealth();
setInterval(checkHealth, 15000);
loadTransactions();
