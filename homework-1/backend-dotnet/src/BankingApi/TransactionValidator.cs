using System.Text.RegularExpressions;

namespace BankingApi;

public static class TransactionValidator
{
    private static readonly Regex AccountRe = new("^ACC-[A-Za-z0-9]+$", RegexOptions.Compiled);

    private static readonly HashSet<string> Iso4217 = new()
    {
        "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "CNY", "HKD",
        "SGD", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "RON", "BGN", "TRY",
        "UAH", "INR", "BRL", "MXN", "ZAR", "KRW", "AED", "SAR", "ILS", "THB",
    };

    public static List<FieldError> Validate(CreateTransactionRequest r)
    {
        var errors = new List<FieldError>();

        ValidateAccount(errors, "fromAccount", r.FromAccount);
        ValidateAccount(errors, "toAccount", r.ToAccount);

        if (r.Amount is null || r.Amount <= 0)
            errors.Add(new FieldError("amount", "Amount must be a positive number"));
        else if (decimal.Round(r.Amount.Value, 2) != r.Amount.Value)
            errors.Add(new FieldError("amount", "Amount must have at most 2 decimal places"));

        if (string.IsNullOrEmpty(r.Currency))
            errors.Add(new FieldError("currency", "Currency is required"));
        else if (!Iso4217.Contains(r.Currency))
            errors.Add(new FieldError("currency", "Invalid currency code"));

        if (string.IsNullOrEmpty(r.Type))
            errors.Add(new FieldError("type", "Type is required"));
        else if (r.Type is not ("deposit" or "withdrawal" or "transfer"))
            errors.Add(new FieldError("type", "Type must be one of: deposit, withdrawal, transfer"));

        return errors;
    }

    private static void ValidateAccount(List<FieldError> errors, string field, string? value)
    {
        if (string.IsNullOrEmpty(value))
            errors.Add(new FieldError(field, $"{field} is required"));
        else if (!AccountRe.IsMatch(value))
            errors.Add(new FieldError(field, "Account number must match the format ACC-XXXXX"));
    }
}
