import 'dart:convert';
import 'dart:html' as html; // web-only: used to trigger the CSV download

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

// Local dev defaults to http://localhost:3000; the Docker build passes
// --dart-define=API_BASE=/api so nginx proxies same-origin (no CORS).
const String apiBase = String.fromEnvironment('API_BASE', defaultValue: 'http://localhost:3000');

void main() => runApp(const BankingApp());

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------
class ApiResult {
  final int status;
  final dynamic body;
  ApiResult(this.status, this.body);
  bool get ok => status >= 200 && status < 300;
}

class ApiService {
  Future<ApiResult> _get(String path) async {
    final res = await http.get(Uri.parse('$apiBase$path'));
    return ApiResult(res.statusCode, res.body.isEmpty ? null : jsonDecode(res.body));
  }

  Future<List<dynamic>> listTransactions(Map<String, String> filters) async {
    final uri = Uri.parse('$apiBase/transactions').replace(queryParameters: {
      for (final e in filters.entries)
        if (e.value.isNotEmpty) e.key: e.value,
    });
    final res = await http.get(uri);
    return res.statusCode == 200 ? (jsonDecode(res.body) as List<dynamic>) : <dynamic>[];
  }

  Future<ApiResult> createTransaction(Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('$apiBase/transactions'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    return ApiResult(res.statusCode, res.body.isEmpty ? null : jsonDecode(res.body));
  }

  Future<ApiResult> balance(String account) => _get('/accounts/$account/balance');
  Future<ApiResult> summary(String account) => _get('/accounts/$account/summary');
  Future<ApiResult> interest(String account, String rate, String days) =>
      _get('/accounts/$account/interest?rate=$rate&days=$days');
  Future<bool> healthy() async {
    try {
      final r = await _get('/actuator/health');
      return r.ok && r.body is Map && r.body['status'] == 'UP';
    } catch (_) {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------
class BankingApp extends StatefulWidget {
  const BankingApp({super.key});
  @override
  State<BankingApp> createState() => _BankingAppState();
}

class _BankingAppState extends State<BankingApp> {
  ThemeMode _mode = ThemeMode.dark;

  ThemeData _theme(Brightness b) => ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0078D4),
          brightness: b,
        ),
      );

  void _toggle() => setState(
      () => _mode = _mode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Banking Transactions',
      theme: _theme(Brightness.light),
      darkTheme: _theme(Brightness.dark),
      themeMode: _mode,
      debugShowCheckedModeBanner: false,
      home: HomePage(onToggleTheme: _toggle, isDark: _mode == ThemeMode.dark),
    );
  }
}

class HomePage extends StatefulWidget {
  final VoidCallback onToggleTheme;
  final bool isDark;
  const HomePage({super.key, required this.onToggleTheme, required this.isDark});
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final api = ApiService();
  int _index = 0;
  bool _apiUp = false;

  @override
  void initState() {
    super.initState();
    _pingHealth();
  }

  Future<void> _pingHealth() async {
    final up = await api.healthy();
    if (mounted) setState(() => _apiUp = up);
  }

  @override
  Widget build(BuildContext context) {
    final views = [
      TransactionsView(api: api),
      NewTransactionView(api: api, onCreated: () => setState(() => _index = 0)),
      AccountToolsView(api: api),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Banking Transactions'),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Chip(
              avatar: Icon(Icons.circle, size: 12, color: _apiUp ? Colors.green : Colors.red),
              label: Text(_apiUp ? 'API online' : 'API offline'),
            ),
          ),
          IconButton(
            onPressed: widget.onToggleTheme,
            icon: Icon(widget.isDark ? Icons.light_mode : Icons.dark_mode),
            tooltip: 'Toggle theme',
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Row(
        children: [
          NavigationRail(
            selectedIndex: _index,
            onDestinationSelected: (i) => setState(() => _index = i),
            labelType: NavigationRailLabelType.all,
            destinations: const [
              NavigationRailDestination(icon: Icon(Icons.list_alt), label: Text('Transactions')),
              NavigationRailDestination(icon: Icon(Icons.add_circle_outline), label: Text('New')),
              NavigationRailDestination(icon: Icon(Icons.account_balance_wallet), label: Text('Accounts')),
            ],
          ),
          const VerticalDivider(width: 1),
          Expanded(child: Padding(padding: const EdgeInsets.all(20), child: views[_index])),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Transactions list + filters + CSV export
// ---------------------------------------------------------------------------
class TransactionsView extends StatefulWidget {
  final ApiService api;
  const TransactionsView({super.key, required this.api});
  @override
  State<TransactionsView> createState() => _TransactionsViewState();
}

class _TransactionsViewState extends State<TransactionsView> {
  final _account = TextEditingController();
  final _from = TextEditingController();
  final _to = TextEditingController();
  String _type = '';
  List<dynamic> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final items = await widget.api.listTransactions({
        'accountId': _account.text,
        'type': _type,
        'from': _from.text,
        'to': _to.text,
      });
      setState(() { _items = items; _loading = false; });
    } catch (_) {
      setState(() { _error = 'Could not load transactions. Is the API running on :3000?'; _loading = false; });
    }
  }

  Color _statusColor(String s) => switch (s) {
        'completed' => Colors.green,
        'pending' => Colors.orange,
        _ => Colors.red,
      };

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('Transactions', style: Theme.of(context).textTheme.headlineSmall),
            const Spacer(),
            OutlinedButton.icon(
              onPressed: () => html.window.open('$apiBase/transactions/export?format=csv', '_blank'),
              icon: const Icon(Icons.download),
              label: const Text('Export CSV'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          crossAxisAlignment: WrapCrossAlignment.end,
          children: [
            SizedBox(width: 160, child: TextField(controller: _account, decoration: const InputDecoration(labelText: 'Account'))),
            SizedBox(
              width: 150,
              child: DropdownButtonFormField<String>(
                value: _type.isEmpty ? null : _type,
                decoration: const InputDecoration(labelText: 'Type'),
                items: const [
                  DropdownMenuItem(value: '', child: Text('All')),
                  DropdownMenuItem(value: 'deposit', child: Text('Deposit')),
                  DropdownMenuItem(value: 'withdrawal', child: Text('Withdrawal')),
                  DropdownMenuItem(value: 'transfer', child: Text('Transfer')),
                ],
                onChanged: (v) => setState(() => _type = v ?? ''),
              ),
            ),
            SizedBox(width: 150, child: TextField(controller: _from, decoration: const InputDecoration(labelText: 'From (YYYY-MM-DD)'))),
            SizedBox(width: 150, child: TextField(controller: _to, decoration: const InputDecoration(labelText: 'To (YYYY-MM-DD)'))),
            FilledButton(onPressed: _load, child: const Text('Apply')),
            OutlinedButton(
              onPressed: () {
                _account.clear(); _from.clear(); _to.clear();
                setState(() => _type = '');
                _load();
              },
              child: const Text('Clear'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Expanded(child: _buildList()),
      ],
    );
  }

  Widget _buildList() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return Center(child: Text(_error!));
    if (_items.isEmpty) return const Center(child: Text('No transactions found.'));
    return ListView.separated(
      itemCount: _items.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (_, i) {
        final t = _items[i] as Map<String, dynamic>;
        final amount = (t['amount'] as num).toStringAsFixed(2);
        return ListTile(
          title: Text('${t['fromAccount']} → ${t['toAccount']}'),
          subtitle: Text('${t['type']} · ${t['timestamp']}'),
          trailing: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('$amount ${t['currency']}', style: const TextStyle(fontWeight: FontWeight.w600)),
              Text(t['status'], style: TextStyle(color: _statusColor(t['status']), fontSize: 12)),
            ],
          ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// New transaction (with validation)
// ---------------------------------------------------------------------------
class NewTransactionView extends StatefulWidget {
  final ApiService api;
  final VoidCallback onCreated;
  const NewTransactionView({super.key, required this.api, required this.onCreated});
  @override
  State<NewTransactionView> createState() => _NewTransactionViewState();
}

class _NewTransactionViewState extends State<NewTransactionView> {
  final _from = TextEditingController();
  final _to = TextEditingController();
  final _amount = TextEditingController();
  String _currency = 'USD';
  String _type = 'transfer';
  Map<String, String> _errors = {};
  bool _submitting = false;

  Future<void> _submit() async {
    setState(() { _errors = {}; _submitting = true; });
    final result = await widget.api.createTransaction({
      'fromAccount': _from.text,
      'toAccount': _to.text,
      'amount': double.tryParse(_amount.text) ?? _amount.text,
      'currency': _currency,
      'type': _type,
    });
    setState(() => _submitting = false);

    if (result.status == 201) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Transaction created.')));
      _from.clear(); _to.clear(); _amount.clear();
      widget.onCreated();
    } else if (result.status == 400 && result.body is Map && result.body['details'] is List) {
      final map = <String, String>{};
      for (final d in (result.body['details'] as List)) {
        map[d['field'] as String] = d['message'] as String;
      }
      setState(() => _errors = map);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not create transaction.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('New transaction', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 16),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: Column(
              children: [
                TextField(controller: _from, decoration: InputDecoration(labelText: 'From account', errorText: _errors['fromAccount'])),
                const SizedBox(height: 12),
                TextField(controller: _to, decoration: InputDecoration(labelText: 'To account', errorText: _errors['toAccount'])),
                const SizedBox(height: 12),
                TextField(controller: _amount, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: 'Amount', errorText: _errors['amount'])),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _currency,
                  decoration: InputDecoration(labelText: 'Currency', errorText: _errors['currency']),
                  items: const ['USD', 'EUR', 'GBP', 'JPY']
                      .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (v) => setState(() => _currency = v ?? 'USD'),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _type,
                  decoration: InputDecoration(labelText: 'Type', errorText: _errors['type']),
                  items: const ['deposit', 'withdrawal', 'transfer']
                      .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                      .toList(),
                  onChanged: (v) => setState(() => _type = v ?? 'transfer'),
                ),
                const SizedBox(height: 20),
                Align(
                  alignment: Alignment.centerLeft,
                  child: FilledButton(
                    onPressed: _submitting ? null : _submit,
                    child: Text(_submitting ? 'Creating…' : 'Create transaction'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Account tools: balance, summary, interest
// ---------------------------------------------------------------------------
class AccountToolsView extends StatefulWidget {
  final ApiService api;
  const AccountToolsView({super.key, required this.api});
  @override
  State<AccountToolsView> createState() => _AccountToolsViewState();
}

class _AccountToolsViewState extends State<AccountToolsView> {
  final _balanceAcc = TextEditingController();
  final _summaryAcc = TextEditingController();
  final _interestAcc = TextEditingController();
  final _rate = TextEditingController(text: '0.05');
  final _days = TextEditingController(text: '30');
  String? _balance;
  Map<String, dynamic>? _summary;
  Map<String, dynamic>? _interest;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Account tools', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 16),
          _card('Balance', [
            SizedBox(width: 200, child: TextField(controller: _balanceAcc, decoration: const InputDecoration(labelText: 'Account'))),
            FilledButton(
              onPressed: () async {
                final r = await widget.api.balance(_balanceAcc.text);
                if (r.ok) setState(() => _balance = (r.body['balance'] as num).toStringAsFixed(2));
              },
              child: const Text('Get balance'),
            ),
            if (_balance != null) Text('Balance: $_balance', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
          ]),
          _card('Summary', [
            SizedBox(width: 200, child: TextField(controller: _summaryAcc, decoration: const InputDecoration(labelText: 'Account'))),
            FilledButton(
              onPressed: () async {
                final r = await widget.api.summary(_summaryAcc.text);
                if (r.ok) setState(() => _summary = r.body as Map<String, dynamic>);
              },
              child: const Text('Get summary'),
            ),
            if (_summary != null)
              Text('Deposits: ${(_summary!['totalDeposits'] as num).toStringAsFixed(2)} · '
                  'Withdrawals: ${(_summary!['totalWithdrawals'] as num).toStringAsFixed(2)} · '
                  'Count: ${_summary!['transactionCount']}'),
          ]),
          _card('Simple interest', [
            SizedBox(width: 160, child: TextField(controller: _interestAcc, decoration: const InputDecoration(labelText: 'Account'))),
            SizedBox(width: 90, child: TextField(controller: _rate, decoration: const InputDecoration(labelText: 'Rate'))),
            SizedBox(width: 90, child: TextField(controller: _days, decoration: const InputDecoration(labelText: 'Days'))),
            FilledButton(
              onPressed: () async {
                final r = await widget.api.interest(_interestAcc.text, _rate.text, _days.text);
                if (r.ok) setState(() => _interest = r.body as Map<String, dynamic>);
              },
              child: const Text('Calculate'),
            ),
            if (_interest != null)
              Text('Interest: ${(_interest!['interest'] as num).toStringAsFixed(2)} '
                  '(balance ${(_interest!['balance'] as num).toStringAsFixed(2)})'),
          ]),
        ],
      ),
    );
  }

  Widget _card(String title, List<Widget> children) => Card(
        margin: const EdgeInsets.only(bottom: 16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              Wrap(spacing: 12, runSpacing: 12, crossAxisAlignment: WrapCrossAlignment.center, children: children),
            ],
          ),
        ),
      );
}
