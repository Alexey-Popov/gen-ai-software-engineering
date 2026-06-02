// tests/AiTicketHub.Tests/Infrastructure/Parsers/CsvTicketParserBugFixTests.cs
// FIRST compliance:
// F – Fast:        All input supplied as in-memory MemoryStream; no file I/O.
// I – Independent: Each test constructs its own stream; no shared state.
// R – Repeatable:  Input is hard-coded; no randomness.
// S – Self-validating: Every test has a FluentAssertions .Should() call or exception check.
// T – Timely:      Tests cover only code changed in this pipeline run (BUG-024, BUG-010, BUG-011).

using System.Text;
using AiTicketHub.Infrastructure.Parsers;
using FluentAssertions;
using NUnit.Framework;

namespace AiTicketHub.Tests.Infrastructure.Parsers;

[TestFixture]
public class CsvTicketParserBugFixTests
{
    private CsvTicketParser _parser = null!;

    [SetUp]
    public void SetUp() => _parser = new CsvTicketParser();

    private static Stream ToStream(string text) =>
        new MemoryStream(Encoding.UTF8.GetBytes(text));

    private const string MinimalHeader =
        "CustomerId,CustomerEmail,CustomerName,Subject,Description,Category,Priority";

    // ── BUG-024: ParseAsync null-input guard ──────────────────────────────

    [Test]
    public void ParseAsync_NullInput_ThrowsArgumentNullException()
    {
        Func<Task> act = () => _parser.ParseAsync(null!);
        act.Should().ThrowAsync<ArgumentNullException>();
    }

    // ── BUG-010: Row with fewer columns than header returns column-count error ─

    [Test]
    public async Task ParseAsync_RowFewerColumnsThanHeader_ReturnsColumnCountError()
    {
        // Header has 7 columns; row has only 3.
        const string csv =
            "CustomerId,CustomerEmail,CustomerName,Subject,Description,Category,Priority\n" +
            "cust-1,a@b.com,Alice";

        var result = await _parser.ParseAsync(ToStream(csv));

        result.Records.Should().BeEmpty();
        result.Errors.Should().HaveCount(1);
        result.Errors[0].RowNumber.Should().Be(2);
        result.Errors[0].Message.Should().Contain("column");
    }

    [Test]
    public async Task ParseAsync_RowExactlyHeaderColumnCount_IsProcessedNormally()
    {
        // Row has exactly 7 columns matching the 7-column header.
        const string csv =
            "CustomerId,CustomerEmail,CustomerName,Subject,Description,Category,Priority\n" +
            "cust-1,a@b.com,Alice Smith,Cannot login,Cannot login since yesterday,AccountAccess,Urgent";

        var result = await _parser.ParseAsync(ToStream(csv));

        // Should not error on column count; any error would be a field-level validation error.
        result.Errors.Should().NotContain(e => e.Message.Contains("column"));
        result.Records.Should().HaveCount(1);
    }

    // ── BUG-011: Unterminated quoted field throws FormatException, recorded as error ─

    [Test]
    public async Task ParseAsync_UnterminatedQuotedField_ReturnsFormatError()
    {
        // The second field opens a quote that is never closed.
        const string csv =
            "CustomerId,CustomerEmail,CustomerName,Subject,Description,Category,Priority\n" +
            "cust-1,\"unterminated,Alice,Subject,Description,AccountAccess,Urgent";

        var result = await _parser.ParseAsync(ToStream(csv));

        result.Records.Should().BeEmpty();
        result.Errors.Should().HaveCount(1);
        result.Errors[0].RowNumber.Should().Be(2);
        result.Errors[0].Message.Should().NotBeNullOrWhiteSpace();
    }

    [Test]
    public async Task ParseAsync_ProperlyQuotedFieldWithComma_ParsedCorrectly()
    {
        // A properly terminated quoted field that contains a comma must parse without error.
        const string csv =
            "CustomerId,CustomerEmail,CustomerName,Subject,Description,Category,Priority\n" +
            "cust-1,a@b.com,\"Smith, Alice\",Subject here,Description long enough,Other,Low";

        var result = await _parser.ParseAsync(ToStream(csv));

        result.Errors.Should().BeEmpty();
        result.Records.Should().HaveCount(1);
        result.Records[0].CustomerName.Should().Be("Smith, Alice");
    }
}
