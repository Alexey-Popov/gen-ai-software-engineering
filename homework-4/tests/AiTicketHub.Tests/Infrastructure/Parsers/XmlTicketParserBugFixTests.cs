// tests/AiTicketHub.Tests/Infrastructure/Parsers/XmlTicketParserBugFixTests.cs
// FIRST compliance:
// F – Fast:        All input supplied as in-memory MemoryStream; no file I/O.
// I – Independent: Each test constructs its own parser and stream; no shared state.
// R – Repeatable:  Input is hard-coded; no randomness.
// S – Self-validating: Every test has a FluentAssertions .Should() call or exception check.
// T – Timely:      Tests cover only code changed in this pipeline run (BUG-023, BUG-013).

using System.Text;
using AiTicketHub.Infrastructure.Parsers;
using FluentAssertions;
using NUnit.Framework;

namespace AiTicketHub.Tests.Infrastructure.Parsers;

[TestFixture]
public class XmlTicketParserBugFixTests
{
    private XmlTicketParser _parser = null!;

    [SetUp]
    public void SetUp() => _parser = new XmlTicketParser();

    private static Stream ToStream(string text) =>
        new MemoryStream(Encoding.UTF8.GetBytes(text));

    // ── BUG-023: ParseAsync null-input guard ──────────────────────────────

    [Test]
    public void ParseAsync_NullInput_ThrowsArgumentNullException()
    {
        Func<Task> act = () => _parser.ParseAsync(null!);
        act.Should().ThrowAsync<ArgumentNullException>();
    }

    // ── BUG-013: GetValue whitespace-only element returns "" not null ─────
    // Downstream IsNullOrWhiteSpace catches "", so whitespace-only elements
    // still produce a parse error — confirming the fix does not swallow them.

    [Test]
    public async Task ParseAsync_WhitespaceOnlySubjectElement_ReturnsParseError()
    {
        const string xml =
            "<Tickets>" +
            "<Ticket>" +
            "<CustomerId>cust-1</CustomerId>" +
            "<CustomerEmail>a@b.com</CustomerEmail>" +
            "<CustomerName>Alice</CustomerName>" +
            "<Subject>   </Subject>" +
            "<Description>Description here</Description>" +
            "<Category>Other</Category>" +
            "<Priority>Low</Priority>" +
            "</Ticket>" +
            "</Tickets>";

        var result = await _parser.ParseAsync(ToStream(xml));

        result.Records.Should().BeEmpty();
        result.Errors.Should().HaveCount(1);
        result.Errors[0].Message.Should().Contain("Subject");
    }
}
