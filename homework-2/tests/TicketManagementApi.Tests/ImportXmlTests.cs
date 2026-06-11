using System.IO;
using System.Text;
using System.Threading.Tasks;
using Xunit;
using TicketManagementApi.Models;
using TicketManagementApi.Repositories;
using TicketManagementApi.Services;
using TicketManagementApi.Tests.Helpers;

namespace TicketManagementApi.Tests;

public class ImportXmlTests
{
    private readonly ITicketRepository _repository;
    private readonly IAutoClassificationService _classifier;
    private readonly IImportService _importService;
    private const string FixtureDir = "/Users/dmytrosamartsov/Documents/repos/gen-ai-software-engineering/homework-2/tests/fixtures";

    public ImportXmlTests()
    {
        _repository = new InMemoryTicketRepository();
        _classifier = new AutoClassificationService(new Microsoft.Extensions.Logging.Abstractions.NullLogger<AutoClassificationService>());
        _importService = new ImportService(_repository, _classifier);
        FixtureGenerator.GenerateAll(FixtureDir);
    }

    [Fact]
    public async Task Import_ValidXml_SucceedsWith30Records()
    {
        var xmlPath = Path.Combine(FixtureDir, "sample_tickets.xml");
        using var stream = File.OpenRead(xmlPath);

        var summary = await _importService.ImportTicketsAsync(stream, "xml", autoClassify: true);

        Assert.Equal(30, summary.TotalRecords);
        Assert.Equal(30, summary.Successful);
        Assert.Equal(0, summary.Failed);
        Assert.Empty(summary.Errors);
    }

    [Fact]
    public async Task Import_MalformedXmlSyntax_ReturnsParserError()
    {
        var xmlPath = Path.Combine(FixtureDir, "invalid_tickets.xml");
        using var stream = File.OpenRead(xmlPath);

        var summary = await _importService.ImportTicketsAsync(stream, "xml", autoClassify: true);

        Assert.Equal(0, summary.Successful);
        Assert.Equal(1, summary.Failed);
        Assert.Contains(summary.Errors, e => e.Row == 0 && e.Error.Contains("Malformed file structure"));
    }

    [Fact]
    public async Task Import_XmlMissingRequiredElements_FailsValidation()
    {
        var xmlContent = @"<?xml version=""1.0"" encoding=""utf-8""?>
        <tickets>
            <ticket>
                <customer_id></customer_id> <!-- Missing -->
                <customer_email>test@example.com</customer_email>
                <customer_name>Name</customer_name>
                <subject>Subject</subject>
                <description>Descriptive ticket details.</description>
                <metadata>
                    <source>web_form</source>
                    <device_type>desktop</device_type>
                </metadata>
            </ticket>
        </tickets>";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(xmlContent));

        var summary = await _importService.ImportTicketsAsync(stream, "xml", autoClassify: true);

        Assert.Equal(1, summary.TotalRecords);
        Assert.Equal(0, summary.Successful);
        Assert.Equal(1, summary.Failed);
        Assert.Contains(summary.Errors, e => e.Row == 1 && e.Error.Contains("customer_id is required"));
    }

    [Fact]
    public async Task Import_XmlInvalidEnum_ReturnsRowLevelParsingErrors()
    {
        var xmlContent = @"<?xml version=""1.0"" encoding=""utf-8""?>
        <tickets>
            <ticket>
                <customer_id>C1</customer_id>
                <customer_email>test@example.com</customer_email>
                <customer_name>Name</customer_name>
                <subject>Subject</subject>
                <description>Descriptive ticket details.</description>
                <category>invalid_category_enum</category>
                <metadata>
                    <source>web_form</source>
                    <device_type>desktop</device_type>
                </metadata>
            </ticket>
        </tickets>";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(xmlContent));

        var summary = await _importService.ImportTicketsAsync(stream, "xml", autoClassify: true);

        Assert.Equal(1, summary.TotalRecords);
        Assert.Equal(0, summary.Successful);
        Assert.Equal(1, summary.Failed);
        Assert.Contains(summary.Errors, e => e.Row == 1 && e.Error.Contains("Invalid category"));
    }

    [Fact]
    public async Task Import_XmlCommaSeparatedTags_ParsesCorrectly()
    {
        var xmlContent = @"<?xml version=""1.0"" encoding=""utf-8""?>
        <tickets>
            <ticket>
                <customer_id>C1</customer_id>
                <customer_email>test@example.com</customer_email>
                <customer_name>Name</customer_name>
                <subject>Subject</subject>
                <description>Descriptive ticket details.</description>
                <tags>tag1,tag2,tag3</tags>
                <metadata>
                    <source>web_form</source>
                    <device_type>desktop</device_type>
                </metadata>
            </ticket>
        </tickets>";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(xmlContent));

        var summary = await _importService.ImportTicketsAsync(stream, "xml", autoClassify: true);

        Assert.Equal(1, summary.Successful);
        Assert.Empty(summary.Errors);

        var tickets = await _repository.GetAllAsync();
        var ticket = tickets.First();
        Assert.Equal(3, ticket.Tags.Count);
        Assert.Contains("tag1", ticket.Tags);
        Assert.Contains("tag2", ticket.Tags);
        Assert.Contains("tag3", ticket.Tags);
    }
}
