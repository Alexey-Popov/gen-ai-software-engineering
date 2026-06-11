using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;
using TicketManagementApi.Models;

namespace TicketManagementApi.Tests;

public class PerformanceTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public PerformanceTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Concurrency_MultipleSimultaneousCreates_SucceedsWithoutRaceConditions()
    {
        // Arrange
        int concurrentRequestsCount = 30; // More than the 20+ required
        var tasks = new List<Task<HttpResponseMessage>>();

        for (int i = 0; i < concurrentRequestsCount; i++)
        {
            var dto = new CreateTicketDto
            {
                CustomerId = $"CUST-CONC-{i}",
                CustomerEmail = $"conc_{i}@example.com",
                CustomerName = $"Concurrent User {i}",
                Subject = "Critical login issue error",
                Description = "I am locked out from my account login credentials.",
                Metadata = new CreateTicketMetadataDto { Source = TicketSource.api, DeviceType = DeviceType.desktop }
            };
            tasks.Add(_client.PostAsJsonAsync("/tickets", dto));
        }

        // Act
        var responses = await Task.WhenAll(tasks);

        // Assert
        Assert.Equal(concurrentRequestsCount, responses.Length);
        foreach (var response in responses)
        {
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        }
    }

    [Fact]
    public async Task Concurrency_MultipleSimultaneousGets_Succeeds()
    {
        // Arrange
        // First create some ticket
        var dto = new CreateTicketDto
        {
            CustomerId = "C1",
            CustomerEmail = "test@example.com",
            CustomerName = "Name",
            Subject = "Subject here",
            Description = "Long description that is descriptive enough.",
            Metadata = new CreateTicketMetadataDto { Source = TicketSource.chat, DeviceType = DeviceType.mobile }
        };
        var createResponse = await _client.PostAsJsonAsync("/tickets", dto);
        var created = await createResponse.Content.ReadFromJsonAsync<Ticket>();

        int getCount = 50;
        var tasks = new List<Task<HttpResponseMessage>>();

        for (int i = 0; i < getCount; i++)
        {
            tasks.Add(_client.GetAsync($"/tickets/{created!.Id}"));
        }

        // Act
        var responses = await Task.WhenAll(tasks);

        // Assert
        Assert.Equal(getCount, responses.Length);
        foreach (var response in responses)
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }

    [Fact]
    public async Task Concurrency_SimultaneousUpdatesToSameTicket_SucceedsWithoutCrash()
    {
        // Arrange
        var dto = new CreateTicketDto
        {
            CustomerId = "C1",
            CustomerEmail = "test@example.com",
            CustomerName = "Original Name",
            Subject = "Subject here",
            Description = "Long description that is descriptive enough.",
            Metadata = new CreateTicketMetadataDto { Source = TicketSource.chat, DeviceType = DeviceType.mobile }
        };
        var createResponse = await _client.PostAsJsonAsync("/tickets", dto);
        var created = await createResponse.Content.ReadFromJsonAsync<Ticket>();

        int updateCount = 25;
        var tasks = new List<Task<HttpResponseMessage>>();

        for (int i = 0; i < updateCount; i++)
        {
            var updateDto = new UpdateTicketDto
            {
                CustomerName = $"Concurrent Name {i}",
                Status = TicketStatus.in_progress
            };
            tasks.Add(_client.PutAsJsonAsync($"/tickets/{created!.Id}", updateDto));
        }

        // Act
        var responses = await Task.WhenAll(tasks);

        // Assert
        Assert.Equal(updateCount, responses.Length);
        foreach (var response in responses)
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }

    [Fact]
    public async Task Latency_SingleTicketCreation_IsFast()
    {
        // Arrange
        var dto = new CreateTicketDto
        {
            CustomerId = "C-LAT",
            CustomerEmail = "latency@example.com",
            CustomerName = "Latency User",
            Subject = "Normal support request",
            Description = "This is a standard description of a support ticket query.",
            Metadata = new CreateTicketMetadataDto { Source = TicketSource.phone, DeviceType = DeviceType.desktop }
        };

        // Warm up client
        await _client.PostAsJsonAsync("/tickets", dto);

        // Act
        var stopwatch = Stopwatch.StartNew();
        var response = await _client.PostAsJsonAsync("/tickets", dto);
        stopwatch.Stop();

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        // Usually, in-memory operations on localhost are sub-10ms. We set threshold to 150ms to account for CI environments.
        Assert.True(stopwatch.ElapsedMilliseconds < 150, $"Expected latency < 150ms but was {stopwatch.ElapsedMilliseconds}ms");
    }

    [Fact]
    public async Task Performance_BulkImport_ProcessesFiftyTicketsQuickly()
    {
        // Arrange
        var csvContent = new System.Text.StringBuilder();
        csvContent.AppendLine("customer_id,customer_email,customer_name,subject,description,source,device_type");
        for (int i = 0; i < 50; i++)
        {
            csvContent.AppendLine($"CUST-{i},test@example.com,Name,Subject {i},Description number {i} is here to satisfy minimum length.,web_form,desktop");
        }

        var contentBytes = System.Text.Encoding.UTF8.GetBytes(csvContent.ToString());
        var fileContent = new ByteArrayContent(contentBytes);
        fileContent.Headers.ContentType = System.Net.Http.Headers.MediaTypeHeaderValue.Parse("text/csv");

        var form = new MultipartFormDataContent();
        form.Add(fileContent, "file", "perf_tickets.csv");

        // Act
        var stopwatch = Stopwatch.StartNew();
        var response = await _client.PostAsync("/tickets/import", form);
        stopwatch.Stop();

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var summary = await response.Content.ReadFromJsonAsync<ImportSummary>();
        Assert.NotNull(summary);
        Assert.Equal(50, summary.Successful);
        Assert.True(stopwatch.ElapsedMilliseconds < 300, $"Expected bulk import to finish < 300ms but was {stopwatch.ElapsedMilliseconds}ms");
    }
}
