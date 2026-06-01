// tests/AiTicketHub.Tests/API/TicketControllerTests.cs
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using AiTicketHub.Application.DTOs;
using AiTicketHub.Domain.Enums;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using NUnit.Framework;

namespace AiTicketHub.Tests.API;

[TestFixture]
public class TicketControllerTests
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

    // ── POST /api/tickets ─────────────────────────────────────────────────

    [Test]
    public async Task CreateTicket_ValidRequest_Returns201WithLocationHeader()
    {
        var response = await _client.PostAsJsonAsync(BaseRoute, new
        {
            customerId    = "cust-1",
            customerEmail = "a@b.com",
            customerName  = "Alice",
            subject       = "Valid subject here",
            description   = "Valid description text here",
            category      = "Other",
            priority      = "Medium",
            source        = "Api",
            deviceType    = "Desktop",
            tags          = Array.Empty<string>()
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        response.Headers.Location.Should().NotBeNull();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("customerId").GetString().Should().Be("cust-1");
        body.GetProperty("status").GetString().Should().Be("New");
    }

    [Test]
    public async Task CreateTicket_EmptySubject_Returns400WithSubjectError()
    {
        var response = await _client.PostAsJsonAsync(BaseRoute, new
        {
            customerId    = "cust-1",
            customerEmail = "a@b.com",
            customerName  = "Alice",
            subject       = "",
            description   = "Valid description text here",
            category      = "Other",
            priority      = "Medium",
            source        = "Api",
            deviceType    = "Desktop",
            tags          = Array.Empty<string>()
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("Subject");
    }

    // ── GET /api/tickets/{id} ─────────────────────────────────────────────

    [Test]
    public async Task GetTicketById_ExistingId_Returns200WithTicketData()
    {
        var id = await CreateTicketAndGetId("subject one", "valid description text here");

        var response = await _client.GetAsync($"{BaseRoute}/{id}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("id").GetGuid().Should().Be(id);
        body.GetProperty("subject").GetString().Should().Be("subject one");
    }

    [Test]
    public async Task GetTicketById_UnknownId_Returns404()
    {
        var response = await _client.GetAsync($"{BaseRoute}/{Guid.NewGuid()}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── GET /api/tickets ──────────────────────────────────────────────────

    [Test]
    public async Task ListTickets_NoTickets_Returns200WithEmptyItems()
    {
        var response = await _client.GetAsync(BaseRoute);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("items").GetArrayLength().Should().Be(0);
        body.GetProperty("totalCount").GetInt32().Should().Be(0);
    }

    [Test]
    public async Task ListTickets_WithCategoryFilter_ReturnsOnlyMatchingTickets()
    {
        await CreateTicketWithCategory("BugReport");
        await CreateTicketWithCategory("Other");

        var response = await _client.GetAsync($"{BaseRoute}?category=BugReport");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("totalCount").GetInt32().Should().Be(1);
        body.GetProperty("items")[0].GetProperty("category").GetString().Should().Be("BugReport");
    }

    // ── PUT /api/tickets/{id} ─────────────────────────────────────────────

    [Test]
    public async Task UpdateTicket_ValidRequest_Returns200WithUpdatedSubject()
    {
        var id = await CreateTicketAndGetId("original subject", "valid description text here");

        var response = await _client.PutAsJsonAsync($"{BaseRoute}/{id}", new { subject = "updated subject" });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("subject").GetString().Should().Be("updated subject");
    }

    [Test]
    public async Task UpdateTicket_EmptySubjectWhenPresent_Returns400WithSubjectError()
    {
        var id = await CreateTicketAndGetId("original subject", "valid description text here");

        var response = await _client.PutAsJsonAsync($"{BaseRoute}/{id}", new { subject = "" });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("Subject");
    }

    [Test]
    public async Task UpdateTicket_UnknownId_Returns404()
    {
        var response = await _client.PutAsJsonAsync($"{BaseRoute}/{Guid.NewGuid()}", new { subject = "new subject" });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Test]
    public async Task UpdateTicket_InvalidStatusTransition_Returns422WithInvalidStatus()
    {
        var id = await CreateTicketAndGetId("subject", "valid description text here");

        // New → Resolved is not a valid transition; only New → InProgress is allowed
        var response = await _client.PutAsJsonAsync($"{BaseRoute}/{id}", new { status = "Resolved" });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("Ticket.InvalidStatus");
    }

    // ── DELETE /api/tickets/{id} ──────────────────────────────────────────

    [Test]
    public async Task DeleteTicket_ExistingTicket_Returns204()
    {
        var id = await CreateTicketAndGetId("to be deleted", "valid description text here");

        var response = await _client.DeleteAsync($"{BaseRoute}/{id}");

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Test]
    public async Task DeleteTicket_UnknownId_Returns404()
    {
        var response = await _client.DeleteAsync($"{BaseRoute}/{Guid.NewGuid()}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Test]
    public async Task DeleteTicket_ResolvedTicket_Returns422WithInvalidStatus()
    {
        var id = await CreateTicketAndGetId("resolved ticket", "valid description text here");
        await TransitionToResolvedAsync(id);

        var response = await _client.DeleteAsync($"{BaseRoute}/{id}");

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("Ticket.InvalidStatus");
    }

    // ── POST /api/tickets/import ──────────────────────────────────────────

    [Test]
    public async Task ImportTickets_ValidJsonFile_Returns200WithAllSuccessful()
    {
        var json = """[{"customerId":"c1","customerEmail":"a@b.com","customerName":"Alice","subject":"Import subject","description":"Valid import description text","category":"Other","priority":"Medium"}]""";
        using var content = BuildImportContent(json, "tickets.json", "application/json");

        var response = await _client.PostAsync($"{BaseRoute}/import", content);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("successful").GetInt32().Should().Be(1);
        body.GetProperty("failed").GetInt32().Should().Be(0);
    }

    [Test]
    public async Task ImportTickets_PartiallyInvalidRows_Returns200WithPartialSuccess()
    {
        var json = """
            [
              {"customerId":"c1","customerEmail":"a@b.com","customerName":"Alice","subject":"Valid row","description":"Valid import description text","category":"Other","priority":"Medium"},
              {"customerId":"","customerEmail":"a@b.com","customerName":"Alice","subject":"Bad row","description":"Valid import description text","category":"Other","priority":"Medium"}
            ]
            """;
        using var content = BuildImportContent(json, "tickets.json", "application/json");

        var response = await _client.PostAsync($"{BaseRoute}/import", content);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("successful").GetInt32().Should().Be(1);
        body.GetProperty("failed").GetInt32().Should().Be(1);
    }

    [Test]
    public async Task ImportTickets_EmptyFile_Returns400WithValidationFailed()
    {
        // 0-byte file → file.Length == 0 → controller returns our custom Validation.Failed 400.
        using var content = BuildImportContent("", "tickets.json", "application/json");

        var response = await _client.PostAsync($"{BaseRoute}/import", content);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("Validation.Failed");
    }

    // ── POST /api/tickets/{id}/auto-classify ────────────────────────────────

    [Test]
    public async Task AutoClassify_ExistingTicket_Returns200WithConfidence()
    {
        var ticketId = await CreateTicketAndGetId("cannot login", "I cannot login with my password");

        var response = await _client.PostAsync($"{BaseRoute}/{ticketId}/auto-classify", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<AutoClassifyResponse>(JsonOptions);
        body.Should().NotBeNull();
        body!.Confidence.Should().BeInRange(0.0, 1.0);
        body.Reasoning.Should().NotBeNullOrWhiteSpace();
    }

    [Test]
    public async Task AutoClassify_NonExistentTicket_Returns404()
    {
        var response = await _client.PostAsync($"{BaseRoute}/{Guid.NewGuid()}/auto-classify", null);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Test]
    public async Task AutoClassify_LoginKeywords_ReturnsAccountAccessCategory()
    {
        var ticketId = await CreateTicketAndGetId("login password reset", "cannot login using my password");

        var response = await _client.PostAsync($"{BaseRoute}/{ticketId}/auto-classify", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("category").GetString().Should().Be("AccountAccess");
    }

    [Test]
    public async Task AutoClassify_WithCategoryOverride_ReturnsThatCategory()
    {
        var ticketId = await CreateTicketAndGetId("some issue", "random description text here");

        var overrideBody = JsonContent.Create(new { categoryOverride = "BugReport" });
        var response = await _client.PostAsync($"{BaseRoute}/{ticketId}/auto-classify", overrideBody);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("category").GetString().Should().Be("BugReport");
    }

    // ── POST /api/tickets with AutoClassify flag ───────────────────────────

    [Test]
    public async Task CreateTicket_AutoClassifyTrue_Returns201WithClassifiedCategory()
    {
        var response = await _client.PostAsJsonAsync(BaseRoute, new
        {
            customerId    = "cust-1",
            customerEmail = "a@b.com",
            customerName  = "Alice",
            subject       = "login password issue",
            description   = "I cannot login with my password since yesterday",
            category      = "Other",
            priority      = "Medium",
            source        = "Api",
            deviceType    = "Desktop",
            tags          = Array.Empty<string>(),
            autoClassify  = true
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("category").GetString().Should().Be("AccountAccess");
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private async Task<Guid> CreateTicketAndGetId(string subject, string description)
    {
        var response = await _client.PostAsJsonAsync(BaseRoute, new
        {
            customerId    = "cust-1",
            customerEmail = "test@example.com",
            customerName  = "Test User",
            subject,
            description,
            category      = "Other",
            priority      = "Medium",
            source        = "Api",
            deviceType    = "Desktop",
            tags          = Array.Empty<string>()
        });
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("id").GetGuid();
    }

    private async Task CreateTicketWithCategory(string category)
    {
        var response = await _client.PostAsJsonAsync(BaseRoute, new
        {
            customerId    = "cust-1",
            customerEmail = "test@example.com",
            customerName  = "Test User",
            subject       = $"Ticket for {category}",
            description   = "valid description text here",
            category,
            priority      = "Medium",
            source        = "Api",
            deviceType    = "Desktop",
            tags          = Array.Empty<string>()
        });
        response.EnsureSuccessStatusCode();
    }

    private async Task TransitionToResolvedAsync(Guid id)
    {
        await PutStatusAsync(id, "InProgress");
        await PutStatusAsync(id, "WaitingCustomer");
        await PutStatusAsync(id, "Resolved");
    }

    private async Task PutStatusAsync(Guid id, string status)
    {
        var response = await _client.PutAsJsonAsync($"{BaseRoute}/{id}", new { status });
        response.EnsureSuccessStatusCode();
    }

    private static MultipartFormDataContent BuildImportContent(string json, string fileName, string contentType)
    {
        var content     = new MultipartFormDataContent();
        var fileContent = new StringContent(json, Encoding.UTF8, contentType);
        content.Add(fileContent, "file", fileName);
        return content;
    }
}
