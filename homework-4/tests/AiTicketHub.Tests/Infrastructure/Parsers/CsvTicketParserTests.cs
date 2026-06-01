// tests/AiTicketHub.Tests/Infrastructure/Parsers/CsvTicketParserTests.cs
using System.Text;
using AiTicketHub.Domain.Enums;
using AiTicketHub.Infrastructure.Parsers;
using FluentAssertions;
using NUnit.Framework;

namespace AiTicketHub.Tests.Infrastructure.Parsers;

[TestFixture]
public class CsvTicketParserTests
{
    private CsvTicketParser _parser = null!;

    [SetUp]
    public void SetUp() => _parser = new CsvTicketParser();

    private static Stream ToStream(string text) =>
        new MemoryStream(Encoding.UTF8.GetBytes(text));

    private const string Header =
        "CustomerId,CustomerEmail,CustomerName,Subject,Description,Category,Priority,Status,AssignedTo,Tags,Source,Browser,DeviceType";

    private const string ValidRow =
        "cust-001,alice@example.com,Alice Smith,Cannot login,Cannot login since yesterday,AccountAccess,Urgent,New,,login|urgent,Api,Chrome,Desktop";

    // a — Happy path
    [Test]
    public async Task ParseAsync_ValidInput_ReturnsMappedRecordWithNoErrors()
    {
        var result = await _parser.ParseAsync(ToStream($"{Header}\n{ValidRow}"));

        result.Records.Should().HaveCount(1);
        result.Errors.Should().BeEmpty();
        result.HasErrors.Should().BeFalse();

        var r = result.Records[0];
        r.CustomerId.Should().Be("cust-001");
        r.CustomerEmail.Should().Be("alice@example.com");
        r.CustomerName.Should().Be("Alice Smith");
        r.Subject.Should().Be("Cannot login");
        r.Description.Should().Be("Cannot login since yesterday");
        r.Category.Should().Be(TicketCategory.AccountAccess);
        r.Priority.Should().Be(TicketPriority.Urgent);
        r.Status.Should().Be(TicketStatus.New);
        r.Tags.Should().BeEquivalentTo(new[] { "login", "urgent" });
        r.Source.Should().Be(TicketSource.Api);
        r.Browser.Should().Be("Chrome");
        r.DeviceType.Should().Be(DeviceType.Desktop);
    }

    // b — Empty file
    [Test]
    public async Task ParseAsync_EmptyStream_ReturnsZeroRecordsAndZeroErrors()
    {
        var result = await _parser.ParseAsync(ToStream(string.Empty));

        result.Records.Should().BeEmpty();
        result.Errors.Should().BeEmpty();
    }

    // c — All rows malformed
    [Test]
    public async Task ParseAsync_AllRowsMalformed_ReturnsZeroRecordsAndErrorPerRow()
    {
        const string csv =
            "CustomerId,CustomerEmail,CustomerName,Subject,Description,Category,Priority\n" +
            ",alice@example.com,Alice Smith,Subject,Description one long,AccountAccess,Urgent\n" +
            ",bob@example.com,Bob Jones,Subject 2,Description two long,TechnicalIssue,High";

        var result = await _parser.ParseAsync(ToStream(csv));

        result.Records.Should().BeEmpty();
        result.Errors.Should().HaveCount(2);
        result.Errors.Should().AllSatisfy(e => e.Message.Should().NotBeNullOrWhiteSpace());
    }

    // d — Mixed valid and invalid rows
    [Test]
    public async Task ParseAsync_MixedRows_SeparatesRecordsAndErrors()
    {
        const string csv =
            "CustomerId,CustomerEmail,CustomerName,Subject,Description,Category,Priority\n" +
            "cust-001,alice@example.com,Alice Smith,Cannot login,Cannot login since yesterday,AccountAccess,Urgent\n" +
            ",bob@example.com,Bob Jones,Something broke,Something broke yesterday,TechnicalIssue,High";

        var result = await _parser.ParseAsync(ToStream(csv));

        result.Records.Should().HaveCount(1);
        result.Errors.Should().HaveCount(1);
        result.Records[0].CustomerId.Should().Be("cust-001");
    }

    // e — Missing required field
    [Test]
    public async Task ParseAsync_MissingSubject_ReturnsErrorNamingMissingField()
    {
        const string csv =
            "CustomerId,CustomerEmail,CustomerName,Subject,Description,Category,Priority\n" +
            "cust-001,alice@example.com,Alice Smith,,Cannot login since yesterday,AccountAccess,Urgent";

        var result = await _parser.ParseAsync(ToStream(csv));

        result.Records.Should().BeEmpty();
        result.Errors.Should().HaveCount(1);
        result.Errors[0].RowNumber.Should().Be(2);
        result.Errors[0].Message.Should().Contain("Subject");
    }

    // f — Invalid enum value
    [Test]
    public async Task ParseAsync_InvalidCategory_ReturnsErrorNamingFieldAndValue()
    {
        const string csv =
            "CustomerId,CustomerEmail,CustomerName,Subject,Description,Category,Priority\n" +
            "cust-001,alice@example.com,Alice Smith,Cannot login,Cannot login since yesterday,NotACategory,Urgent";

        var result = await _parser.ParseAsync(ToStream(csv));

        result.Records.Should().BeEmpty();
        result.Errors.Should().HaveCount(1);
        result.Errors[0].Message.Should().Contain("NotACategory");
        result.Errors[0].Message.Should().Contain("Category");
    }

    // g — Extra unknown columns ignored
    [Test]
    public async Task ParseAsync_ExtraColumns_IgnoredSilently()
    {
        const string csv =
            "CustomerId,CustomerEmail,CustomerName,Subject,Description,Category,Priority,ExtraField\n" +
            "cust-001,alice@example.com,Alice Smith,Cannot login,Cannot login since yesterday,AccountAccess,Urgent,SomeExtraValue";

        var result = await _parser.ParseAsync(ToStream(csv));

        result.Records.Should().HaveCount(1);
        result.Errors.Should().BeEmpty();
    }

    // h — Whitespace-only value treated as missing
    [Test]
    public async Task ParseAsync_WhitespaceOnlySubject_ReturnsParseError()
    {
        const string csv =
            "CustomerId,CustomerEmail,CustomerName,Subject,Description,Category,Priority\n" +
            "cust-001,alice@example.com,Alice Smith,   ,Cannot login since yesterday,AccountAccess,Urgent";

        var result = await _parser.ParseAsync(ToStream(csv));

        result.Records.Should().BeEmpty();
        result.Errors.Should().HaveCount(1);
        result.Errors[0].Message.Should().Contain("Subject");
    }
}
