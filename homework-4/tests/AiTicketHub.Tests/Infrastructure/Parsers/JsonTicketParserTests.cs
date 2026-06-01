// tests/AiTicketHub.Tests/Infrastructure/Parsers/JsonTicketParserTests.cs
using System.Text;
using AiTicketHub.Domain.Enums;
using AiTicketHub.Infrastructure.Parsers;
using FluentAssertions;
using NUnit.Framework;

namespace AiTicketHub.Tests.Infrastructure.Parsers;

[TestFixture]
public class JsonTicketParserTests
{
    private JsonTicketParser _parser = null!;

    [SetUp]
    public void SetUp() => _parser = new JsonTicketParser();

    private static Stream ToStream(string text) =>
        new MemoryStream(Encoding.UTF8.GetBytes(text));

    private const string ValidRecord =
        "{\"customerId\":\"cust-001\",\"customerEmail\":\"alice@example.com\",\"customerName\":\"Alice Smith\"," +
        "\"subject\":\"Cannot login\",\"description\":\"Cannot login since yesterday\"," +
        "\"category\":\"AccountAccess\",\"priority\":\"Urgent\",\"status\":\"New\"," +
        "\"tags\":[\"login\",\"urgent\"],\"source\":\"Api\",\"browser\":\"Chrome\",\"deviceType\":\"Desktop\"}";

    private const string InvalidRecord =
        "{\"customerEmail\":\"b@c.com\",\"customerName\":\"B\",\"subject\":\"S\"," +
        "\"description\":\"Desc\",\"category\":\"Other\",\"priority\":\"Low\"}";

    // a — Happy path
    [Test]
    public async Task ParseAsync_ValidArray_ReturnsMappedRecordWithNoErrors()
    {
        var result = await _parser.ParseAsync(ToStream("[" + ValidRecord + "]"));

        result.Records.Should().HaveCount(1);
        result.Errors.Should().BeEmpty();

        var r = result.Records[0];
        r.CustomerId.Should().Be("cust-001");
        r.CustomerEmail.Should().Be("alice@example.com");
        r.Category.Should().Be(TicketCategory.AccountAccess);
        r.Priority.Should().Be(TicketPriority.Urgent);
        r.Status.Should().Be(TicketStatus.New);
        r.Tags.Should().BeEquivalentTo(new[] { "login", "urgent" });
        r.Source.Should().Be(TicketSource.Api);
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

    // c — All rows malformed (missing required field)
    [Test]
    public async Task ParseAsync_AllElementsMissingRequiredField_ReturnsErrorPerElement()
    {
        const string row1 = "{\"customerEmail\":\"a@b.com\",\"customerName\":\"A\",\"subject\":\"S\",\"description\":\"Desc long\",\"category\":\"AccountAccess\",\"priority\":\"Urgent\"}";
        const string row2 = "{\"customerEmail\":\"b@c.com\",\"customerName\":\"B\",\"subject\":\"S\",\"description\":\"Desc long\",\"category\":\"TechnicalIssue\",\"priority\":\"High\"}";
        var json = "[" + row1 + "," + row2 + "]";

        var result = await _parser.ParseAsync(ToStream(json));

        result.Records.Should().BeEmpty();
        result.Errors.Should().HaveCount(2);
        result.Errors.Should().AllSatisfy(e => e.Message.Should().NotBeNullOrWhiteSpace());
    }

    // d — Mixed valid and invalid rows
    [Test]
    public async Task ParseAsync_MixedElements_SeparatesRecordsAndErrors()
    {
        var json = "[" + ValidRecord + "," + InvalidRecord + "]";

        var result = await _parser.ParseAsync(ToStream(json));

        result.Records.Should().HaveCount(1);
        result.Errors.Should().HaveCount(1);
    }

    // e — Missing required field with correct row number
    [Test]
    public async Task ParseAsync_MissingSubject_ReturnsErrorNamingField()
    {
        const string json =
            "[{\"customerId\":\"c1\",\"customerEmail\":\"a@b.com\",\"customerName\":\"A\"," +
            "\"description\":\"Desc long\",\"category\":\"AccountAccess\",\"priority\":\"Urgent\"}]";

        var result = await _parser.ParseAsync(ToStream(json));

        result.Records.Should().BeEmpty();
        result.Errors.Should().HaveCount(1);
        result.Errors[0].RowNumber.Should().Be(1);
        result.Errors[0].Message.Should().Contain("subject");
    }

    // f — Invalid enum value
    [Test]
    public async Task ParseAsync_InvalidPriority_ReturnsErrorNamingFieldAndValue()
    {
        const string json =
            "[{\"customerId\":\"c1\",\"customerEmail\":\"a@b.com\",\"customerName\":\"A\"," +
            "\"subject\":\"S\",\"description\":\"Long desc\",\"category\":\"AccountAccess\",\"priority\":\"INVALID\"}]";

        var result = await _parser.ParseAsync(ToStream(json));

        result.Records.Should().BeEmpty();
        result.Errors.Should().HaveCount(1);
        result.Errors[0].Message.Should().Contain("INVALID");
        result.Errors[0].Message.Should().Contain("priority");
    }

    // g — Extra unknown fields ignored
    [Test]
    public async Task ParseAsync_ExtraFields_IgnoredSilently()
    {
        const string json =
            "[{\"customerId\":\"c1\",\"customerEmail\":\"a@b.com\",\"customerName\":\"A\"," +
            "\"subject\":\"S\",\"description\":\"Long desc\",\"category\":\"Other\",\"priority\":\"Low\"," +
            "\"unknownField\":\"ignored\"}]";

        var result = await _parser.ParseAsync(ToStream(json));

        result.Records.Should().HaveCount(1);
        result.Errors.Should().BeEmpty();
    }

    // h — Whitespace-only string treated as missing
    [Test]
    public async Task ParseAsync_WhitespaceOnlyDescription_ReturnsParseError()
    {
        const string json =
            "[{\"customerId\":\"c1\",\"customerEmail\":\"a@b.com\",\"customerName\":\"A\"," +
            "\"subject\":\"S\",\"description\":\"   \",\"category\":\"Other\",\"priority\":\"Low\"}]";

        var result = await _parser.ParseAsync(ToStream(json));

        result.Records.Should().BeEmpty();
        result.Errors.Should().HaveCount(1);
        result.Errors[0].Message.Should().Contain("description");
    }
}
