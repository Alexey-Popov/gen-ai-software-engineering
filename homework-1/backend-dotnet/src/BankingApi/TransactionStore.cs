using System.Collections.Concurrent;

namespace BankingApi;

/// In-memory, thread-safe transaction store (no database).
public class TransactionStore
{
    private readonly ConcurrentDictionary<string, Transaction> _items = new();

    public Transaction Save(Transaction transaction)
    {
        _items[transaction.Id] = transaction;
        return transaction;
    }

    public IReadOnlyList<Transaction> FindAll() => _items.Values.ToList();

    public Transaction? FindById(string id) =>
        _items.TryGetValue(id, out var t) ? t : null;

    public void Clear() => _items.Clear();
}
