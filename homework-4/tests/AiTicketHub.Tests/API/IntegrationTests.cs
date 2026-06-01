// tests/AiTicketHub.Tests/API/IntegrationTests.cs
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using NUnit.Framework;

namespace AiTicketHub.Tests.API;

[TestFixture]
public class IntegrationTests
{
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient                     _client  = null!;

    private const string BaseRoute = "/api/tickets";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        Converters            = { new System.Text.Json.Serialization.JsonStringEnumConverter() },
        PropertyNameCaseInsensitive = true
    };

    [SetUp]
    public void SetUp()
    {
        _factory = new WebApplicationFactory<Program>();
        _client  = _factory.CreateClient();
    }

    [TearDown]
    public void TearDown()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    // ── Full lifecycle ────────────────────────────────────────────────────

    [Test]
    public async Task FullLifecycle_CreateClassifyUpdateResolve_VerifiesEachStep()
    {
        // 1 — Create
        var createResponse = await _client.PostAsJsonAsync(BaseRoute, new
        {
            customerId    = "cust-lifecycle",
            customerEmail = "lifecycle@example.com",
            customerName  = "Lifecycle User",
            subject       = "login password issue",
            description   = "cannot login using my password",
            category      = "Other",
            priority      = "Medium",
            source        = "Api",
            deviceType    = "Desktop",
            tags          = Array.Empty<string>()
        });
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var createBody = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var id         = createBody.GetProperty("id").GetGuid();

        // 2 — Auto-classify
        var classifyResponse = await _client.PostAsync($"{BaseRoute}/{id}/auto-classify", null);
        classifyResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var classifyBody = await classifyResponse.Content.ReadFromJsonAsync<JsonElement>();
        classifyBody.GetProperty("category").GetString().Should().Be("AccountAccess");
        classifyBody.GetProperty("confidence").GetDouble().Should().BeGreaterThan(0.0);

        // 3 — Update subject
        var updateResponse = await _client.PutAsJsonAsync($"{BaseRoute}/{id}", new { subject = "updated login subject" });
        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var updateBody = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
        updateBody.GetProperty("subject").GetString().Should().Be("updated login subject");

        // 4 — Transition to Resolved
        await PutStatusAsync(id, "InProgress");
        await PutStatusAsync(id, "WaitingCustomer");
        var resolveResponse = await PutStatusAsync(id, "Resolved");
        var resolveBody     = await resolveResponse.Content.ReadFromJsonAsync<JsonElement>();
        resolveBody.GetProperty("status").GetString().Should().Be("Resolved");
        resolveBody.GetProperty("resolvedAt").GetString().Should().NotBeNullOrWhiteSpace();

        // 5 — Delete of resolved ticket must be rejected
        var deleteResponse = await _client.DeleteAsync($"{BaseRoute}/{id}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var deleteBody = await deleteResponse.Content.ReadAsStringAsync();
        deleteBody.Should().Contain("Ticket.InvalidStatus");
    }

    // ── Bulk import → auto-classify all ──────────────────────────────────

    [Test]
    public async Task BulkImport_ThenAutoClassifyAll_AllReturnAccountAccessCategory()
    {
        var json = """
            [
              {"customerId":"c1","customerEmail":"a@b.com","customerName":"Alice","subject":"login issue","description":"cannot login with my password","category":"Other","priority":"Medium"},
              {"customerId":"c2","customerEmail":"b@b.com","customerName":"Bob",  "subject":"password reset","description":"my password does not work at all","category":"Other","priority":"Medium"},
              {"customerId":"c3","customerEmail":"c@b.com","customerName":"Carol","subject":"2fa login problem","description":"login is broken for my account","category":"Other","priority":"Medium"}
            ]
            """;
        using var importContent = BuildImportContent(json, "tickets.json", "application/json");

        var importResponse = await _client.PostAsync($"{BaseRoute}/import", importContent);
        importResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var importBody = await importResponse.Content.ReadFromJsonAsync<JsonElement>();
        importBody.GetProperty("successful").GetInt32().Should().Be(3);

        // Retrieve all tickets to get their IDs
        var listResponse = await _client.GetAsync(BaseRoute);
        listResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var listBody  = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
        var items     = listBody.GetProperty("items").EnumerateArray().ToList();
        items.Should().HaveCount(3);

        foreach (var item in items)
        {
            var ticketId       = item.GetProperty("id").GetGuid();
            var classifyResp   = await _client.PostAsync($"{BaseRoute}/{ticketId}/auto-classify", null);
            classifyResp.StatusCode.Should().Be(HttpStatusCode.OK);
            var classifyBody   = await classifyResp.Content.ReadFromJsonAsync<JsonElement>();
            classifyBody.GetProperty("category").GetString().Should().Be("AccountAccess");
        }
    }

    // ── 20 concurrent CreateTicket requests ──────────────────────────────

    [Test]
    public async Task ConcurrentCreate_20Requests_AllReturn201AndStoredCount20()
    {
        var tasks = Enumerable.Range(1, 20).Select(i => _client.PostAsJsonAsync(BaseRoute, new
        {
            customerId    = $"cust-{i}",
            customerEmail = $"user{i}@example.com",
            customerName  = $"User {i}",
            subject       = $"Concurrent ticket number {i}",
            description   = "This is a concurrent creation test description",
            category      = "Other",
            priority      = "Medium",
            source        = "Api",
            deviceType    = "Desktop",
            tags          = Array.Empty<string>()
        })).ToList();

        var responses = await Task.WhenAll(tasks);

        responses.Should().AllSatisfy(r => r.StatusCode.Should().Be(HttpStatusCode.Created));

        var listResponse = await _client.GetAsync($"{BaseRoute}?pageSize=50");
        listResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var listBody = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
        listBody.GetProperty("totalCount").GetInt32().Should().Be(20);
    }

    // ── Combined filter: category AND priority ────────────────────────────

    [Test]
    public async Task ListTickets_FilterByCategoryAndPriority_ReturnsOnlyMatchingTickets()
    {
        await CreateTicketWith("BugReport", "High");
        await CreateTicketWith("BugReport", "Low");
        await CreateTicketWith("Other",     "High");

        var response = await _client.GetAsync($"{BaseRoute}?category=BugReport&priority=High");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body  = await response.Content.ReadFromJsonAsync<JsonElement>();
        var total = body.GetProperty("totalCount").GetInt32();
        total.Should().Be(1);
        var onlyItem = body.GetProperty("items")[0];
        onlyItem.GetProperty("category").GetString().Should().Be("BugReport");
        onlyItem.GetProperty("priority").GetString().Should().Be("High");
    }

    // ── Pagination ────────────────────────────────────────────────────────

    [Test]
    public async Task ListTickets_Pagination_CorrectItemsReturnedPerPage()
    {
        for (var i = 1; i <= 5; i++)
            await CreateTicketWith("Other", "Medium");

        var page1Response = await _client.GetAsync($"{BaseRoute}?page=1&pageSize=2");
        page1Response.StatusCode.Should().Be(HttpStatusCode.OK);
        var page1Body = await page1Response.Content.ReadFromJsonAsync<JsonElement>();
        page1Body.GetProperty("totalCount").GetInt32().Should().Be(5);
        page1Body.GetProperty("items").GetArrayLength().Should().Be(2);
        page1Body.GetProperty("page").GetInt32().Should().Be(1);

        var page3Response = await _client.GetAsync($"{BaseRoute}?page=3&pageSize=2");
        page3Response.StatusCode.Should().Be(HttpStatusCode.OK);
        var page3Body = await page3Response.Content.ReadFromJsonAsync<JsonElement>();
        page3Body.GetProperty("items").GetArrayLength().Should().Be(1);
        page3Body.GetProperty("page").GetInt32().Should().Be(3);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private async Task<HttpResponseMessage> PutStatusAsync(Guid id, string status)
    {
        var response = await _client.PutAsJsonAsync($"{BaseRoute}/{id}", new { status });
        response.EnsureSuccessStatusCode();
        return response;
    }

    private async Task CreateTicketWith(string category, string priority)
    {
        var response = await _client.PostAsJsonAsync(BaseRoute, new
        {
            customerId    = "cust-filter",
            customerEmail = "filter@example.com",
            customerName  = "Filter User",
            subject       = $"Ticket {category} {priority}",
            description   = "filter test description text here",
            category,
            priority,
            source        = "Api",
            deviceType    = "Desktop",
            tags          = Array.Empty<string>()
        });
        response.EnsureSuccessStatusCode();
    }

    private static MultipartFormDataContent BuildImportContent(string body, string fileName, string contentType)
    {
        var form    = new MultipartFormDataContent();
        var content = new StringContent(body, Encoding.UTF8, contentType);
        form.Add(content, "file", fileName);
        return form;
    }
}
