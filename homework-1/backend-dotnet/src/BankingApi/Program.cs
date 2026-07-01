using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using BankingApi;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<TransactionStore>();
builder.Services.AddSingleton<TransactionService>();
builder.Services.AddSingleton<AccountService>();

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
});

builder.Services.AddOpenApi();

// Honor ASPNETCORE_URLS when set (e.g. http://+:3000 in Docker); default to localhost for local runs.
builder.WebHost.UseUrls(
    Environment.GetEnvironmentVariable("ASPNETCORE_URLS") ?? "http://localhost:3000");

var app = builder.Build();

// OpenAPI spec at /openapi/v1.json, rendered by Scalar at /docs.
app.MapOpenApi();
app.MapGet("/docs", () => Results.Content(
    """
    <!doctype html>
    <html>
      <head><meta charset="utf-8" /><title>Banking API (.NET) — Reference</title></head>
      <body>
        <script id="api-reference" data-url="/openapi/v1.json"></script>
        <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
      </body>
    </html>
    """,
    "text/html"));

// Per-IP rate limiting (configurable; tests use a low limit)
var rateLimit = builder.Configuration.GetValue("RateLimit:Limit", 100);
var rateWindow = builder.Configuration.GetValue("RateLimit:WindowSeconds", 60);
app.UseMiddleware<RateLimitingMiddleware>(rateLimit, rateWindow);

app.MapPost("/transactions", (CreateTransactionRequest req, TransactionService svc) =>
{
    var errors = TransactionValidator.Validate(req);
    if (errors.Count > 0)
        return Results.Json(new { error = "Validation failed", details = errors }, statusCode: 400);

    var created = svc.Create(req);
    return Results.Created($"/transactions/{created.Id}", created);
});

app.MapGet("/transactions", (string? accountId, string? type, DateOnly? from, DateOnly? to, TransactionService svc) =>
    Results.Ok(svc.Find(accountId, type, from, to)));

app.MapGet("/transactions/export", (HttpContext ctx, string? format, TransactionService svc) =>
{
    format ??= "csv";
    if (format != "csv")
        return Results.Json(new { error = "Bad request", message = $"Unsupported export format: {format}" }, statusCode: 400);

    var sb = new StringBuilder();
    sb.Append("id,fromAccount,toAccount,amount,currency,type,timestamp,status\n");
    foreach (var t in svc.FindAll())
    {
        sb.Append(string.Join(",",
            t.Id, t.FromAccount, t.ToAccount,
            t.Amount.ToString(CultureInfo.InvariantCulture), t.Currency,
            t.Type.ToString().ToLowerInvariant(),
            t.Timestamp.ToString("o"),
            t.Status.ToString().ToLowerInvariant()));
        sb.Append('\n');
    }
    ctx.Response.Headers.ContentDisposition = "attachment; filename=\"transactions.csv\"";
    return Results.Text(sb.ToString(), "text/csv");
});

app.MapGet("/transactions/{id}", (string id, TransactionService svc) =>
{
    var t = svc.FindById(id);
    return t is null
        ? Results.Json(new { error = "Transaction not found", id }, statusCode: 404)
        : Results.Ok(t);
});

app.MapGet("/accounts/{accountId}/balance", (string accountId, AccountService svc) =>
    Results.Ok(new { accountId, balance = svc.BalanceOf(accountId) }));

app.MapGet("/accounts/{accountId}/summary", (string accountId, AccountService svc) =>
    Results.Ok(svc.SummaryOf(accountId)));

app.MapGet("/accounts/{accountId}/interest", (string accountId, string? rate, string? days, AccountService svc) =>
{
    if (rate is null || days is null)
        return Results.Json(new { error = "Bad request", message = "rate and days are required" }, statusCode: 400);
    if (!decimal.TryParse(rate, NumberStyles.Number, CultureInfo.InvariantCulture, out var rateValue))
        return Results.Json(new { error = "Bad request", message = "rate must be a number" }, statusCode: 400);
    if (!int.TryParse(days, out var daysValue))
        return Results.Json(new { error = "Bad request", message = "days must be an integer" }, statusCode: 400);
    try
    {
        return Results.Ok(svc.Interest(accountId, rateValue, daysValue));
    }
    catch (ArgumentException ex)
    {
        return Results.Json(new { error = "Bad request", message = ex.Message }, statusCode: 400);
    }
});

app.MapGet("/actuator/health", () => Results.Ok(new { status = "UP" }));

app.Run();

// Exposed so the test project's WebApplicationFactory<Program> can boot the app.
public partial class Program { }
