using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using TicketManagementApi.Models;
using TicketManagementApi.Repositories;

namespace TicketManagementApi.Tests;

public class TicketApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    private readonly ITicketRepository _repository;

    public TicketApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
        
        // Resolve the singleton repository to clear state before each test
        var scope = factory.Services.CreateScope();
        _repository = scope.ServiceProvider.GetRequiredService<ITicketRepository>();
        _repository.ClearAsync().GetAwaiter().GetResult();
    }

    private CreateTicketDto CreateValidTicketDto()
    {
        return new CreateTicketDto
        {
            CustomerId = "C-500",
            CustomerEmail = "bob@example.com",
            CustomerName = "Bob Smith",
            Subject = "Can't access account: Need help with login credentials",
            Description = "I can't access my portal because of a locked out credentials message.",
            Metadata = new CreateTicketMetadataDto
            {
                Source = TicketSource.email,
                DeviceType = DeviceType.mobile
            }
        };
    }

    [Fact]
    public async Task CreateTicket_ValidData_Returns201CreatedAndSaves()
    {
        var dto = CreateValidTicketDto();

        var response = await _client.PostAsJsonAsync("/tickets", dto);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var ticket = await response.Content.ReadFromJsonAsync<Ticket>();
        Assert.NotNull(ticket);
        Assert.NotEqual(Guid.Empty, ticket.Id);
        Assert.Equal(TicketCategory.account_access, ticket.Category); // auto-classified
        Assert.Equal(TicketPriority.urgent, ticket.Priority); // "cannot login" -> urgent
    }

    [Fact]
    public async Task CreateTicket_InvalidData_Returns400BadRequest()
    {
        var dto = CreateValidTicketDto();
        dto.CustomerEmail = "invalid-email";

        var response = await _client.PostAsJsonAsync("/tickets", dto);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetAllTickets_WithNoTickets_Returns200OkEmptyList()
    {
        var response = await _client.GetAsync("/tickets");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var tickets = await response.Content.ReadFromJsonAsync<List<Ticket>>();
        Assert.NotNull(tickets);
        Assert.Empty(tickets);
    }

    [Fact]
    public async Task GetTicketById_ExistingId_Returns200Ok()
    {
        var dto = CreateValidTicketDto();
        var postResponse = await _client.PostAsJsonAsync("/tickets", dto);
        var created = await postResponse.Content.ReadFromJsonAsync<Ticket>();

        var response = await _client.GetAsync($"/tickets/{created!.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var fetched = await response.Content.ReadFromJsonAsync<Ticket>();
        Assert.NotNull(fetched);
        Assert.Equal(created.Id, fetched.Id);
    }

    [Fact]
    public async Task GetTicketById_NonExistingId_Returns404NotFound()
    {
        var response = await _client.GetAsync($"/tickets/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateTicket_ExistingId_Returns200OkAndUpdates()
    {
        var dto = CreateValidTicketDto();
        var postResponse = await _client.PostAsJsonAsync("/tickets", dto);
        var created = await postResponse.Content.ReadFromJsonAsync<Ticket>();

        var updateDto = new UpdateTicketDto
        {
            CustomerName = "Updated Bob",
            Status = TicketStatus.in_progress,
            Tags = new List<string> { "new-tag" }
        };

        var response = await _client.PutAsJsonAsync($"/tickets/{created!.Id}", updateDto);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<Ticket>();
        Assert.NotNull(updated);
        Assert.Equal("Updated Bob", updated.CustomerName);
        Assert.Equal(TicketStatus.in_progress, updated.Status);
        Assert.Contains("new-tag", updated.Tags);
    }

    [Fact]
    public async Task UpdateTicket_NonExistingId_Returns404NotFound()
    {
        var updateDto = new UpdateTicketDto { CustomerName = "No One" };

        var response = await _client.PutAsJsonAsync($"/tickets/{Guid.NewGuid()}", updateDto);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteTicket_ExistingId_Returns204NoContent()
    {
        var dto = CreateValidTicketDto();
        var postResponse = await _client.PostAsJsonAsync("/tickets", dto);
        var created = await postResponse.Content.ReadFromJsonAsync<Ticket>();

        var response = await _client.DeleteAsync($"/tickets/{created!.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        
        // Assert it is deleted
        var getResponse = await _client.GetAsync($"/tickets/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
    }

    [Fact]
    public async Task DeleteTicket_NonExistingId_Returns404NotFound()
    {
        var response = await _client.DeleteAsync($"/tickets/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AutoClassifyTicket_ExistingId_CalculatesAndUpdates()
    {
        // 1. Create a ticket manually with 'other' and 'low' (overriding classification)
        var dto = CreateValidTicketDto();
        dto.Category = TicketCategory.other;
        dto.Priority = TicketPriority.low;
        dto.AutoClassify = false;

        var postResponse = await _client.PostAsJsonAsync("/tickets", dto);
        var created = await postResponse.Content.ReadFromJsonAsync<Ticket>();
        Assert.Equal(TicketCategory.other, created!.Category);
        Assert.Equal(TicketPriority.low, created.Priority);

        // 2. Trigger auto-classify
        var response = await _client.PostAsync($"/tickets/{created.Id}/auto-classify", null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<AutoClassifyResult>();
        
        Assert.NotNull(result);
        Assert.Equal(TicketCategory.account_access, result.Category);
        Assert.Equal(TicketPriority.urgent, result.Priority);

        // 3. Fetch ticket again to verify it was saved
        var getResponse = await _client.GetAsync($"/tickets/{created.Id}");
        var fetched = await getResponse.Content.ReadFromJsonAsync<Ticket>();
        Assert.Equal(TicketCategory.account_access, fetched!.Category);
        Assert.Equal(TicketPriority.urgent, fetched.Priority);
    }

    [Fact]
    public async Task GetAllTickets_WithFiltering_FiltersCorrectly()
    {
        // Create 2 tickets
        var t1 = CreateValidTicketDto(); // urgent, account_access
        var t2 = CreateValidTicketDto();
        t2.Subject = "Billing question duplicate pay"; // medium, billing_question
        t2.Description = "I paid twice for invoice 12345.";

        await _client.PostAsJsonAsync("/tickets", t1);
        await _client.PostAsJsonAsync("/tickets", t2);

        // Filter by category
        var response = await _client.GetAsync("/tickets?category=billing_question");
        var list = await response.Content.ReadFromJsonAsync<List<Ticket>>();
        Assert.NotNull(list);
        Assert.Single(list);
        Assert.Equal(TicketCategory.billing_question, list[0].Category);

        // Filter by priority
        var responsePriority = await _client.GetAsync("/tickets?priority=urgent");
        var listPriority = await responsePriority.Content.ReadFromJsonAsync<List<Ticket>>();
        Assert.NotNull(listPriority);
        Assert.Single(listPriority);
        Assert.Equal(TicketPriority.urgent, listPriority[0].Priority);
    }
}
