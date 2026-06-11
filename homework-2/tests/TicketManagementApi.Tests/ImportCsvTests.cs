using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Xunit;
using TicketManagementApi.Models;
using TicketManagementApi.Repositories;
using TicketManagementApi.Services;
using TicketManagementApi.Tests.Helpers;

namespace TicketManagementApi.Tests;

public class ImportCsvTests
{
    private readonly ITicketRepository _repository;
    private readonly IAutoClassificationService _classifier;
    private readonly IImportService _importService;
    private const string FixtureDir = "/Users/dmytrosamartsov/Documents/repos/gen-ai-software-engineering/homework-2/tests/fixtures";

    public ImportCsvTests()
    {
        _repository = new InMemoryTicketRepository();
        // Simple mock classification or direct classification
        _classifier = new AutoClassificationService(new Microsoft.Extensions.Logging.Abstractions.NullLogger<AutoClassificationService>());
        _importService = new ImportService(_repository, _classifier);
        
        // Ensure fixtures are generated
        FixtureGenerator.GenerateAll(FixtureDir);
    }

    [Fact]
    public async Task Import_ValidCsv_SucceedsWith50Records()
    {
        var csvPath = Path.Combine(FixtureDir, "sample_tickets.csv");
        using var stream = File.OpenRead(csvPath);

        var summary = await _importService.ImportTicketsAsync(stream, "csv", autoClassify: true);

        Assert.Equal(50, summary.TotalRecords);
        Assert.Equal(50, summary.Successful);
        Assert.Equal(0, summary.Failed);
        Assert.Empty(summary.Errors);
    }

    [Fact]
    public async Task Import_InvalidCsv_ReportsCorrectErrors()
    {
        var csvPath = Path.Combine(FixtureDir, "invalid_tickets.csv");
        using var stream = File.OpenRead(csvPath);

        var summary = await _importService.ImportTicketsAsync(stream, "csv", autoClassify: true);

        // invalid_tickets.csv has 6 data rows total:
        // row 2: valid
        // row 3: missing customer id
        // row 4: invalid email
        // row 5: too short description
        // row 6: invalid category
        // row 7: invalid source
        Assert.Equal(6, summary.TotalRecords);
        Assert.Equal(1, summary.Successful);
        Assert.Equal(5, summary.Failed);
        Assert.Equal(5, summary.Errors.Count);

        // Check specifics
        Assert.Contains(summary.Errors, e => e.Row == 3 && e.Error.Contains("customer_id"));
        Assert.Contains(summary.Errors, e => e.Row == 4 && e.Error.Contains("customer_email"));
        Assert.Contains(summary.Errors, e => e.Row == 5 && e.Error.Contains("description"));
        Assert.Contains(summary.Errors, e => e.Row == 6 && e.Error.Contains("category"));
        Assert.Contains(summary.Errors, e => e.Row == 7 && e.Error.Contains("source"));
    }

    [Fact]
    public async Task Import_EmptyCsv_ReturnsFileEmptyError()
    {
        var csvContent = "";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csvContent));

        var summary = await _importService.ImportTicketsAsync(stream, "csv", autoClassify: true);

        Assert.Equal(1, summary.Failed);
        Assert.Contains(summary.Errors, e => e.Row == 0 && e.Error.Contains("File is empty"));
    }

    [Fact]
    public async Task Import_CsvMissingHeaders_ReturnsHeaderError()
    {
        var csvContent = "subject,description\nTest Subject,Short Desc";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csvContent));

        var summary = await _importService.ImportTicketsAsync(stream, "csv", autoClassify: true);

        Assert.Equal(0, summary.Successful);
        Assert.Contains(summary.Errors, e => e.Row == 1 && e.Error.Contains("Missing required headers"));
    }

    [Fact]
    public async Task Import_CsvWithCommasInQuotes_ParsesCorrectly()
    {
        var csvContent = "customer_id,customer_email,customer_name,subject,description,source,device_type\n" +
                         "C1,a@b.com,Name,\"Subject, with comma\",\"Desc with, comma and new line\",web_form,desktop";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csvContent));

        var summary = await _importService.ImportTicketsAsync(stream, "csv", autoClassify: true);

        Assert.Equal(1, summary.Successful);
        Assert.Empty(summary.Errors);

        var tickets = await _repository.GetAllAsync();
        var ticket = tickets.First();
        Assert.Equal("Subject, with comma", ticket.Subject);
        Assert.Equal("Desc with, comma and new line", ticket.Description);
    }

    [Fact]
    public async Task Import_CsvWithEscapedQuotes_ParsesCorrectly()
    {
        var csvContent = "customer_id,customer_email,customer_name,subject,description,source,device_type\n" +
                         "C1,a@b.com,Name,Subject,\"Description containing a \"\"quote\"\" word\",web_form,desktop";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csvContent));

        var summary = await _importService.ImportTicketsAsync(stream, "csv", autoClassify: true);

        Assert.Equal(1, summary.Successful);
        Assert.Empty(summary.Errors);

        var tickets = await _repository.GetAllAsync();
        var ticket = tickets.First();
        Assert.Equal("Description containing a \"quote\" word", ticket.Description);
    }
}
