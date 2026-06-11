using System.IO;
using System.Text;
using System.Threading.Tasks;
using Xunit;
using TicketManagementApi.Models;
using TicketManagementApi.Repositories;
using TicketManagementApi.Services;
using TicketManagementApi.Tests.Helpers;

namespace TicketManagementApi.Tests;

public class ImportJsonTests
{
    private readonly ITicketRepository _repository;
    private readonly IAutoClassificationService _classifier;
    private readonly IImportService _importService;
    private const string FixtureDir = "/Users/dmytrosamartsov/Documents/repos/gen-ai-software-engineering/homework-2/tests/fixtures";

    public ImportJsonTests()
    {
        _repository = new InMemoryTicketRepository();
        _classifier = new AutoClassificationService(new Microsoft.Extensions.Logging.Abstractions.NullLogger<AutoClassificationService>());
        _importService = new ImportService(_repository, _classifier);
        FixtureGenerator.GenerateAll(FixtureDir);
    }

    [Fact]
    public async Task Import_ValidJson_SucceedsWith20Records()
    {
        var jsonPath = Path.Combine(FixtureDir, "sample_tickets.json");
        using var stream = File.OpenRead(jsonPath);

        var summary = await _importService.ImportTicketsAsync(stream, "json", autoClassify: true);

        Assert.Equal(20, summary.TotalRecords);
        Assert.Equal(20, summary.Successful);
        Assert.Equal(0, summary.Failed);
        Assert.Empty(summary.Errors);
    }

    [Fact]
    public async Task Import_MalformedJsonSyntax_ReturnsParserError()
    {
        var jsonPath = Path.Combine(FixtureDir, "invalid_tickets.json");
        using var stream = File.OpenRead(jsonPath);

        var summary = await _importService.ImportTicketsAsync(stream, "json", autoClassify: true);

        Assert.Equal(0, summary.Successful);
        Assert.Equal(1, summary.Failed);
        Assert.Contains(summary.Errors, e => e.Row == 0 && e.Error.Contains("JSON parsing error"));
    }

    [Fact]
    public async Task Import_JsonMissingRequiredFields_FailsValidation()
    {
        var jsonContent = @"[
            {
                ""customer_id"": """",
                ""customer_email"": ""test@test.com"",
                ""customer_name"": ""Name"",
                ""subject"": ""Subject"",
                ""description"": ""Descriptive sentence here."",
                ""metadata"": {
                    ""source"": ""web_form"",
                    ""device_type"": ""desktop""
                }
            }
        ]";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(jsonContent));

        var summary = await _importService.ImportTicketsAsync(stream, "json", autoClassify: true);

        Assert.Equal(1, summary.TotalRecords);
        Assert.Equal(0, summary.Successful);
        Assert.Equal(1, summary.Failed);
        Assert.Contains(summary.Errors, e => e.Row == 1 && e.Error.Contains("customer_id"));
    }

    [Fact]
    public async Task Import_JsonInvalidEnumString_FailsValidation()
    {
        var jsonContent = @"[
            {
                ""customer_id"": ""C1"",
                ""customer_email"": ""test@test.com"",
                ""customer_name"": ""Name"",
                ""subject"": ""Subject"",
                ""description"": ""Descriptive sentence here."",
                ""metadata"": {
                    ""source"": ""invalid_source_enum"",
                    ""device_type"": ""desktop""
                }
            }
        ]";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(jsonContent));

        var summary = await _importService.ImportTicketsAsync(stream, "json", autoClassify: true);

        Assert.Equal(0, summary.Successful);
        Assert.Equal(1, summary.Failed);
        Assert.Contains(summary.Errors, e => e.Row == 0 && e.Error.Contains("JSON parsing error"));
    }

    [Fact]
    public async Task Import_EmptyJsonArray_SucceedsWithZeroRecords()
    {
        var jsonContent = "[]";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(jsonContent));

        var summary = await _importService.ImportTicketsAsync(stream, "json", autoClassify: true);

        Assert.Equal(0, summary.TotalRecords);
        Assert.Equal(0, summary.Successful);
        Assert.Equal(0, summary.Failed);
        Assert.Empty(summary.Errors);
    }
}
