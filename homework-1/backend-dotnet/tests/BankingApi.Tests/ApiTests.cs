using System.Linq;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace BankingApi.Tests;

public class ApiTests
{
    private static HttpClient NewClient(int rateLimit = 100)
    {
        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(b => b.UseSetting("RateLimit:Limit", rateLimit.ToString()));
        return factory.CreateClient();
    }

    private static object Tx(
        string from = "ACC-12345", string to = "ACC-67890",
        object? amount = null, string currency = "USD", string type = "transfer")
        => new { fromAccount = from, toAccount = to, amount = amount ?? 100.50m, currency, type };

    private static async Task<JsonElement> Json(HttpResponseMessage r) =>
        await r.Content.ReadFromJsonAsync<JsonElement>();

    private static bool HasField(JsonElement body, string field) =>
        body.GetProperty("details").EnumerateArray()
            .Any(d => d.GetProperty("field").GetString() == field);

    // ---- Task 1: create & retrieve ----

    [Fact]
    public async Task Create_Returns201_WithGeneratedFields()
    {
        var client = NewClient();
        var r = await client.PostAsJsonAsync("/transactions", Tx());
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var b = await Json(r);
        Assert.False(string.IsNullOrEmpty(b.GetProperty("id").GetString()));
        Assert.Equal("completed", b.GetProperty("status").GetString());
        Assert.Equal("transfer", b.GetProperty("type").GetString());
        Assert.Equal(100.50m, b.GetProperty("amount").GetDecimal());
    }

    [Fact]
    public async Task List_Empty_ReturnsEmptyArray()
    {
        var client = NewClient();
        var r = await client.GetAsync("/transactions");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal(0, (await Json(r)).GetArrayLength());
    }

    [Fact]
    public async Task GetById_Unknown_Returns404()
    {
        var client = NewClient();
        var r = await client.GetAsync("/transactions/does-not-exist");
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        Assert.Equal("Transaction not found", (await Json(r)).GetProperty("error").GetString());
    }

    // ---- Task 2: validation ----

    [Fact]
    public async Task NegativeAmount_Returns400_OnAmount()
    {
        var r = await NewClient().PostAsJsonAsync("/transactions", Tx(amount: -5));
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        var b = await Json(r);
        Assert.Equal("Validation failed", b.GetProperty("error").GetString());
        Assert.True(HasField(b, "amount"));
    }

    [Fact]
    public async Task BadAccount_Returns400_OnFromAccount()
    {
        var r = await NewClient().PostAsJsonAsync("/transactions", Tx(from: "12345"));
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.True(HasField(await Json(r), "fromAccount"));
    }

    [Fact]
    public async Task InvalidCurrency_Returns400_OnCurrency()
    {
        var r = await NewClient().PostAsJsonAsync("/transactions", Tx(currency: "XYZ"));
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.True(HasField(await Json(r), "currency"));
    }

    [Fact]
    public async Task InvalidType_Returns400_OnType()
    {
        var r = await NewClient().PostAsJsonAsync("/transactions", Tx(type: "gift"));
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.True(HasField(await Json(r), "type"));
    }

    [Fact]
    public async Task MultipleErrors_ReturnsAllDetails()
    {
        var r = await NewClient().PostAsJsonAsync("/transactions", Tx(amount: -5, currency: "XYZ"));
        var b = await Json(r);
        Assert.True(HasField(b, "amount"));
        Assert.True(HasField(b, "currency"));
    }

    // ---- Task 3 & 4A/4B: accounts ----

    [Fact]
    public async Task Balance_ReflectsDepositAndWithdrawal()
    {
        var client = NewClient();
        await client.PostAsJsonAsync("/transactions", Tx("ACC-000", "ACC-12345", 200.00m, "USD", "deposit"));
        await client.PostAsJsonAsync("/transactions", Tx("ACC-12345", "ACC-000", 50.00m, "USD", "withdrawal"));
        var b = await Json(await client.GetAsync("/accounts/ACC-12345/balance"));
        Assert.Equal(150.00m, b.GetProperty("balance").GetDecimal());
    }

    [Fact]
    public async Task Balance_UnknownAccount_IsZero()
    {
        var b = await Json(await NewClient().GetAsync("/accounts/ACC-99999/balance"));
        Assert.Equal(0m, b.GetProperty("balance").GetDecimal());
    }

    [Fact]
    public async Task Summary_Aggregates()
    {
        var client = NewClient();
        await client.PostAsJsonAsync("/transactions", Tx("ACC-000", "ACC-12345", 200.00m, "USD", "deposit"));
        await client.PostAsJsonAsync("/transactions", Tx("ACC-000", "ACC-12345", 50.00m, "USD", "deposit"));
        await client.PostAsJsonAsync("/transactions", Tx("ACC-12345", "ACC-000", 30.00m, "USD", "withdrawal"));
        var b = await Json(await client.GetAsync("/accounts/ACC-12345/summary"));
        Assert.Equal(250.00m, b.GetProperty("totalDeposits").GetDecimal());
        Assert.Equal(30.00m, b.GetProperty("totalWithdrawals").GetDecimal());
        Assert.Equal(3, b.GetProperty("transactionCount").GetInt32());
    }

    [Fact]
    public async Task Interest_ReturnsInputsAndResult()
    {
        var client = NewClient();
        await client.PostAsJsonAsync("/transactions", Tx("ACC-000", "ACC-12345", 1000.00m, "USD", "deposit"));
        var b = await Json(await client.GetAsync("/accounts/ACC-12345/interest?rate=0.05&days=365"));
        Assert.Equal(1000.00m, b.GetProperty("balance").GetDecimal());
        Assert.Equal(365, b.GetProperty("days").GetInt32());
        Assert.Equal(50.00m, b.GetProperty("interest").GetDecimal());
    }

    [Fact]
    public async Task Interest_MissingParam_Returns400()
    {
        var r = await NewClient().GetAsync("/accounts/ACC-12345/interest?days=30");
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
    }

    // ---- Task 3: filtering ----

    [Fact]
    public async Task Filter_ByAccount_And_Type()
    {
        var client = NewClient();
        await client.PostAsJsonAsync("/transactions", Tx("ACC-A", "ACC-B", 10m, "USD", "transfer"));
        await client.PostAsJsonAsync("/transactions", Tx("ACC-C", "ACC-A", 10m, "USD", "deposit"));
        await client.PostAsJsonAsync("/transactions", Tx("ACC-X", "ACC-Y", 10m, "USD", "transfer"));

        Assert.Equal(2, (await Json(await client.GetAsync("/transactions?accountId=ACC-A"))).GetArrayLength());
        Assert.Equal(2, (await Json(await client.GetAsync("/transactions?type=transfer"))).GetArrayLength());
        Assert.Equal(1, (await Json(await client.GetAsync("/transactions?accountId=ACC-A&type=transfer"))).GetArrayLength());
    }

    // ---- Task 4C: CSV export ----

    [Fact]
    public async Task Export_ReturnsCsvWithAttachment()
    {
        var r = await NewClient().GetAsync("/transactions/export?format=csv");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Contains("text/csv", r.Content.Headers.ContentType?.MediaType);
        Assert.Contains("attachment", r.Content.Headers.ContentDisposition?.ToString() ?? "");
    }

    [Fact]
    public async Task Export_UnsupportedFormat_Returns400()
    {
        var r = await NewClient().GetAsync("/transactions/export?format=xml");
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
    }

    // ---- Ops: health & rate limiting ----

    [Fact]
    public async Task Health_ReturnsUp()
    {
        var b = await Json(await NewClient().GetAsync("/actuator/health"));
        Assert.Equal("UP", b.GetProperty("status").GetString());
    }

    [Fact]
    public async Task RateLimit_OverLimit_Returns429()
    {
        var client = NewClient(rateLimit: 3);
        for (int i = 0; i < 3; i++)
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/transactions")).StatusCode);
        var r = await client.GetAsync("/transactions");
        Assert.Equal(HttpStatusCode.TooManyRequests, r.StatusCode);
        Assert.Equal("Too Many Requests", (await Json(r)).GetProperty("error").GetString());
    }
}
