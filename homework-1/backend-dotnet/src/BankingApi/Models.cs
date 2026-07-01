using System.Text.Json.Serialization;

namespace BankingApi;

public enum TransactionType { Deposit, Withdrawal, Transfer }

public enum TransactionStatus { Pending, Completed, Failed }

public record Transaction(
    string Id,
    string FromAccount,
    string ToAccount,
    decimal Amount,
    string Currency,
    TransactionType Type,
    DateTimeOffset Timestamp,
    TransactionStatus Status);

// Incoming payload; fields are nullable so validation can produce structured messages
// instead of failing during model binding.
public record CreateTransactionRequest(
    string? FromAccount,
    string? ToAccount,
    decimal? Amount,
    string? Currency,
    string? Type);

public record FieldError(
    [property: JsonPropertyName("field")] string Field,
    [property: JsonPropertyName("message")] string Message);

public record SummaryResponse(
    decimal TotalDeposits,
    decimal TotalWithdrawals,
    int TransactionCount,
    DateTimeOffset? MostRecentTransactionDate);

public record InterestResponse(
    string AccountId,
    decimal Balance,
    decimal Rate,
    int Days,
    decimal Interest);
