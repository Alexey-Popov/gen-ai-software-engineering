// tests/AiTicketHub.Tests/Infrastructure/Parsers/XmlTicketParserTests.cs
using System.Text;
using AiTicketHub.Domain.Enums;
using AiTicketHub.Infrastructure.Parsers;
using FluentAssertions;
using NUnit.Framework;

namespace AiTicketHub.Tests.Infrastructure.Parsers;

[TestFixture]
public class XmlTicketParserTests
{
    private XmlTicketParser _parser = null!;

    [SetUp]
    public void SetUp() => _parser = new XmlTicketParser();

    private static Stream ToStream(string text) =>
        new MemoryStream(Encoding.UTF8.GetBytes(text));

    private const string ValidTicketXml =
        "<Ticket>" +
        "<CustomerId>cust-001</CustomerId>" +
        "<CustomerEmail>alice@example.com</CustomerEmail>" +
        "<CustomerName>Alice Smith</CustomerName>" +
        "<Subject>Cannot login</Subject>" +
        "<Description>Cannot login since yesterday</Description>" +
        "<Category>AccountAccess</Category>" +
        "<Priority>Urgent</Priority>" +
        "<Status>New</Status>" +
        "<Tags>login|urgent</Tags>" +
        "<Source>Api</Source>" +
        "<Browser>Chrome</Browser>" +
        "<DeviceType>Desktop</DeviceType>" +
        "</Ticket>";

    // a — Happy path
    [Test]
    public async Task ParseAsync_ValidDocument_ReturnsMappedRecordWithNoErrors()
    {
        var xml = $"<Tickets>{ValidTicketXml}</Tickets>";
        var result = await _parser.ParseAsync(ToStream(xml));

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

    // c — All elements malformed
    [Test]
    public async Task ParseAsync_AllElementsMissingRequiredField_ReturnsErrorPerElement()
    {
        const string xml =
            "<Tickets>" +
            "<Ticket><CustomerEmail>a@b.com</CustomerEmail><CustomerName>A</CustomerName><Subject>S</Subject><Description>D</Description><Category>AccountAccess</Category><Priority>Urgent</Priority></Ticket>" +
            "<Ticket><CustomerEmail>b@c.com</CustomerEmail><CustomerName>B</CustomerName><Subject>S</Subject><Description>D</Description><Category>Other</Category><Priority>Low</Priority></Ticket>" +
            "</Tickets>";

        var result = await _parser.ParseAsync(ToStream(xml));

        result.Records.Should().BeEmpty();
        result.Errors.Should().HaveCount(2);
        result.Errors.Should().AllSatisfy(e => e.Message.Should().NotBeNullOrWhiteSpace());
    }

    // d — Mixed valid and invalid elements
    [Test]
    public async Task ParseAsync_MixedElements_SeparatesRecordsAndErrors()
    {
        var xml =
            "<Tickets>" +
            ValidTicketXml +
            "<Ticket><CustomerEmail>b@c.com</CustomerEmail></Ticket>" +
            "</Tickets>";

        var result = await _parser.ParseAsync(ToStream(xml));

        result.Records.Should().HaveCount(1);
        result.Errors.Should().HaveCount(1);
    }

    // e — Missing required field with correct row number
    [Test]
    public async Task ParseAsync_MissingCategory_ReturnsErrorNamingMissingField()
    {
        const string xml =
            "<Tickets>" +
            "<Ticket><CustomerId>c1</CustomerId><CustomerEmail>a@b.com</CustomerEmail><CustomerName>A</CustomerName><Subject>S</Subject><Description>D</Description><Priority>Urgent</Priority></Ticket>" +
            "</Tickets>";

        var result = await _parser.ParseAsync(ToStream(xml));

        result.Records.Should().BeEmpty();
        result.Errors.Should().HaveCount(1);
        result.Errors[0].RowNumber.Should().Be(1);
        result.Errors[0].Message.Should().Contain("Category");
    }

    // f — Invalid enum value
    [Test]
    public async Task ParseAsync_InvalidSource_ReturnsErrorNamingFieldAndValue()
    {
        const string xml =
            "<Tickets>" +
            "<Ticket><CustomerId>c1</CustomerId><CustomerEmail>a@b.com</CustomerEmail><CustomerName>A</CustomerName><Subject>S</Subject><Description>D</Description><Category>Other</Category><Priority>Low</Priority><Source>INVALID_SOURCE</Source></Ticket>" +
            "</Tickets>";

        var result = await _parser.ParseAsync(ToStream(xml));

        result.Records.Should().BeEmpty();
        result.Errors.Should().HaveCount(1);
        result.Errors[0].Message.Should().Contain("INVALID_SOURCE");
        result.Errors[0].Message.Should().Contain("Source");
    }

    // g — Extra unknown elements ignored
    [Test]
    public async Task ParseAsync_ExtraElements_IgnoredSilently()
    {
        const string xml =
            "<Tickets>" +
            "<Ticket><CustomerId>c1</CustomerId><CustomerEmail>a@b.com</CustomerEmail><CustomerName>A</CustomerName><Subject>S</Subject><Description>D</Description><Category>Other</Category><Priority>Low</Priority><UnknownElement>ignored</UnknownElement></Ticket>" +
            "</Tickets>";

        var result = await _parser.ParseAsync(ToStream(xml));

        result.Records.Should().HaveCount(1);
        result.Errors.Should().BeEmpty();
    }

    // h — Whitespace-only element treated as missing
    [Test]
    public async Task ParseAsync_WhitespaceOnlyCustomerId_ReturnsParseError()
    {
        const string xml =
            "<Tickets>" +
            "<Ticket><CustomerId>   </CustomerId><CustomerEmail>a@b.com</CustomerEmail><CustomerName>A</CustomerName><Subject>S</Subject><Description>D</Description><Category>Other</Category><Priority>Low</Priority></Ticket>" +
            "</Tickets>";

        var result = await _parser.ParseAsync(ToStream(xml));

        result.Records.Should().BeEmpty();
        result.Errors.Should().HaveCount(1);
        result.Errors[0].Message.Should().Contain("CustomerId");
    }
}
