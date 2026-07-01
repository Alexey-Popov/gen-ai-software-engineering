namespace BankingApi;

public class TransactionService
{
    private readonly TransactionStore _store;

    public TransactionService(TransactionStore store) => _store = store;

    public Transaction Create(CreateTransactionRequest r)
    {
        var transaction = new Transaction(
            Guid.NewGuid().ToString(),
            r.FromAccount!,
            r.ToAccount!,
            r.Amount!.Value,
            r.Currency!,
            Enum.Parse<TransactionType>(r.Type!, ignoreCase: true),
            DateTimeOffset.UtcNow,
            TransactionStatus.Completed);
        return _store.Save(transaction);
    }

    public IReadOnlyList<Transaction> FindAll() => _store.FindAll();

    public Transaction? FindById(string id) => _store.FindById(id);

    public IReadOnlyList<Transaction> Find(string? accountId, string? type, DateOnly? from, DateOnly? to)
    {
        return _store.FindAll().Where(t =>
            (accountId is null || t.FromAccount == accountId || t.ToAccount == accountId) &&
            (type is null || t.Type.ToString().ToLowerInvariant() == type) &&
            (from is null || DateOnly.FromDateTime(t.Timestamp.UtcDateTime) >= from) &&
            (to is null || DateOnly.FromDateTime(t.Timestamp.UtcDateTime) <= to)
        ).ToList();
    }
}

public class AccountService
{
    private readonly TransactionStore _store;

    public AccountService(TransactionStore store) => _store = store;

    public decimal BalanceOf(string account)
    {
        decimal balance = 0m;
        foreach (var t in _store.FindAll())
        {
            if (t.Status != TransactionStatus.Completed) continue;
            switch (t.Type)
            {
                case TransactionType.Deposit:
                    if (t.ToAccount == account) balance += t.Amount;
                    break;
                case TransactionType.Withdrawal:
                    if (t.FromAccount == account) balance -= t.Amount;
                    break;
                case TransactionType.Transfer:
                    if (t.FromAccount == account) balance -= t.Amount;
                    if (t.ToAccount == account) balance += t.Amount;
                    break;
            }
        }
        return balance;
    }

    public SummaryResponse SummaryOf(string account)
    {
        decimal deposits = 0m, withdrawals = 0m;
        int count = 0;
        DateTimeOffset? mostRecent = null;

        foreach (var t in _store.FindAll())
        {
            if (t.FromAccount != account && t.ToAccount != account) continue;
            count++;
            if (mostRecent is null || t.Timestamp > mostRecent) mostRecent = t.Timestamp;
            if (t.Status == TransactionStatus.Completed)
            {
                if (t.Type == TransactionType.Deposit && t.ToAccount == account) deposits += t.Amount;
                else if (t.Type == TransactionType.Withdrawal && t.FromAccount == account) withdrawals += t.Amount;
            }
        }
        return new SummaryResponse(deposits, withdrawals, count, mostRecent);
    }

    public InterestResponse Interest(string account, decimal rate, int days)
    {
        if (rate < 0) throw new ArgumentException("rate must be zero or positive");
        if (days <= 0) throw new ArgumentException("days must be a positive integer");

        var balance = BalanceOf(account);
        var interest = Math.Round(balance * rate * days / 365m, 2, MidpointRounding.AwayFromZero);
        return new InterestResponse(account, balance, rate, days, interest);
    }
}
