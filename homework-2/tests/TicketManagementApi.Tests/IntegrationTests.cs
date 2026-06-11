using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using TicketManagementApi.Models;
using TicketManagementApi.Repositories;
using TicketManagementApi.Tests.Helpers;

namespace TicketManagementApi.Tests;

public class IntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    private readonly ITicketRepository _repository;
    private const string FixtureDir = "/Users/dmytrosamartsov/Documents/repos/gen-ai-software-engineering/homework-2/tests/fixtures";

    public IntegrationTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
        var scope = factory.Services.CreateScope();
        _repository = scope.ServiceProvider.GetRequiredService<ITicketRepository>();
        _repository.ClearAsync().GetAwaiter().GetResult();
        FixtureGenerator.GenerateAll(FixtureDir);
    }

    [Fact]
    public async Task TicketLifecycleWorkflow_CreatesUpdatesResolvesCorrectly()
    {
        // 1. Create a ticket (starts as 'new')
        var createDto = new CreateTicketDto
        {
            CustomerId = "CUST-Lifecycle",
            CustomerEmail = "lifecycle@example.com",
            CustomerName = "Lifecycle User",
            Subject = "Billing error crash", // classified as technical_issue / high
            Description = "The billing screen crashed when I clicked submit payment.",
            Metadata = new CreateTicketMetadataDto { Source = TicketSource.web_form, DeviceType = DeviceType.desktop }
        };

        var response = await _client.PostAsJsonAsync("/tickets", createDto);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var ticket = await response.Content.ReadFromJsonAsync<Ticket>();
        Assert.NotNull(ticket);
        Assert.Equal(TicketStatus.@new, ticket.Status);
        Assert.Null(ticket.ResolvedAt);

        // 2. Put ticket in progress
        var updateDto = new UpdateTicketDto { Status = TicketStatus.in_progress, AssignedTo = "agent_life" };
        var updateResponse = await _client.PutAsJsonAsync($"/tickets/{ticket.Id}", updateDto);
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var inProgressTicket = await updateResponse.Content.ReadFromJsonAsync<Ticket>();
        Assert.NotNull(inProgressTicket);
        Assert.Equal(TicketStatus.in_progress, inProgressTicket.Status);
        Assert.Equal("agent_life", inProgressTicket.AssignedTo);
        Assert.Null(inProgressTicket.ResolvedAt);

        // 3. Resolve ticket and verify resolved_at gets set
        var resolveDto = new UpdateTicketDto { Status = TicketStatus.resolved };
        var resolveResponse = await _client.PutAsJsonAsync($"/tickets/{ticket.Id}", resolveDto);
        Assert.Equal(HttpStatusCode.OK, resolveResponse.StatusCode);
        var resolvedTicket = await resolveResponse.Content.ReadFromJsonAsync<Ticket>();
        
        Assert.NotNull(resolvedTicket);
        Assert.Equal(TicketStatus.resolved, resolvedTicket.Status);
        Assert.NotNull(resolvedTicket.ResolvedAt);
        Assert.True((DateTime.UtcNow - resolvedTicket.ResolvedAt.Value).TotalMinutes < 1);
    }

    [Fact]
    public async Task BulkImportCsvWorkflow_ImportsAndListsWithFilters()
    {
        // 1. Upload CSV
        var csvPath = Path.Combine(FixtureDir, "sample_tickets.csv");
        using var fileContent = new StreamContent(File.OpenRead(csvPath));
        fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("text/csv");

        using var form = new MultipartFormDataContent();
        form.Add(fileContent, "file", "sample_tickets.csv");

        var response = await _client.PostAsync("/tickets/import?autoClassify=true", form);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var summary = await response.Content.ReadFromJsonAsync<ImportSummary>();
        Assert.NotNull(summary);
        Assert.Equal(50, summary.Successful);

        // 2. Query and filter results
        var filterResponse = await _client.GetAsync("/tickets?category=account_access&priority=urgent");
        Assert.Equal(HttpStatusCode.OK, filterResponse.StatusCode);
        var tickets = await filterResponse.Content.ReadFromJsonAsync<List<Ticket>>();
        Assert.NotNull(tickets);
        Assert.NotEmpty(tickets);
        
        foreach (var t in tickets)
        {
            Assert.Equal(TicketCategory.account_access, t.Category);
            Assert.Equal(TicketPriority.urgent, t.Priority);
        }
    }

    [Fact]
    public async Task BulkImportJsonWorkflow_ImportsValidData()
    {
        var jsonPath = Path.Combine(FixtureDir, "sample_tickets.json");
        using var fileContent = new StreamContent(File.OpenRead(jsonPath));
        fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("application/json");

        using var form = new MultipartFormDataContent();
        form.Add(fileContent, "file", "sample_tickets.json");

        var response = await _client.PostAsync("/tickets/import?autoClassify=true", form);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var summary = await response.Content.ReadFromJsonAsync<ImportSummary>();
        Assert.NotNull(summary);
        Assert.Equal(20, summary.Successful);
    }

    [Fact]
    public async Task BulkImportXmlWorkflow_AutoclassifiesCorrectly()
    {
        var xmlPath = Path.Combine(FixtureDir, "sample_tickets.xml");
        using var fileContent = new StreamContent(File.OpenRead(xmlPath));
        fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("application/xml");

        using var form = new MultipartFormDataContent();
        form.Add(fileContent, "file", "sample_tickets.xml");

        var response = await _client.PostAsync("/tickets/import?autoClassify=true", form);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var summary = await response.Content.ReadFromJsonAsync<ImportSummary>();
        Assert.NotNull(summary);
        Assert.Equal(30, summary.Successful);

        // Get tickets to verify classification was run
        var getResponse = await _client.GetAsync("/tickets");
        var tickets = await getResponse.Content.ReadFromJsonAsync<List<Ticket>>();
        Assert.NotNull(tickets);
        Assert.Equal(30, tickets.Count);

        // Verify that all tickets have a category and priority assigned
        foreach (var t in tickets)
        {
            Assert.NotEqual(TicketCategory.other, t.Category == TicketCategory.other && t.ClassificationConfidence == 1.0 ? TicketCategory.other : (TicketCategory?)null);
            Assert.NotNull(t.ClassificationConfidence);
        }
    }

    [Fact]
    public async Task ManualOverrideWorkflow_PreservesCategoryPriority()
    {
        // 1. Create a ticket (will be auto-classified as account_access / urgent)
        var createDto = new CreateTicketDto
        {
            CustomerId = "CUST-Override",
            CustomerEmail = "override@example.com",
            CustomerName = "Override User",
            Subject = "Can't access account: resetting credentials lockout",
            Description = "I can't access my account, it is locked out when logging in.",
            Metadata = new CreateTicketMetadataDto { Source = TicketSource.api, DeviceType = DeviceType.tablet }
        };

        var postResponse = await _client.PostAsJsonAsync("/tickets", createDto);
        var created = await postResponse.Content.ReadFromJsonAsync<Ticket>();
        Assert.Equal(TicketCategory.account_access, created!.Category);
        Assert.Equal(TicketPriority.urgent, created.Priority);
        Assert.True(created.ClassificationConfidence < 1.0); // was auto-classified

        // 2. Put manual override (change to feature_request / low)
        var updateDto = new UpdateTicketDto
        {
            Category = TicketCategory.feature_request,
            Priority = TicketPriority.low
        };

        var putResponse = await _client.PutAsJsonAsync($"/tickets/{created.Id}", updateDto);
        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);
        var updated = await putResponse.Content.ReadFromJsonAsync<Ticket>();
        
        Assert.NotNull(updated);
        Assert.Equal(TicketCategory.feature_request, updated.Category);
        Assert.Equal(TicketPriority.low, updated.Priority);
        Assert.Equal(1.0, updated.ClassificationConfidence); // set to 1.0 (manual override)
        Assert.Contains("Manually updated", updated.ClassificationReasoning);
    }
}
