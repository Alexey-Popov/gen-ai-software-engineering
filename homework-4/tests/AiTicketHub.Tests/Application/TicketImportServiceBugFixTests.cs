// tests/AiTicketHub.Tests/Application/TicketImportServiceBugFixTests.cs
// FIRST compliance:
// F – Fast:        No I/O or sleep; all parser/repository calls are mocked.
// I – Independent: Each test gets a fresh mock set via SetUp; no shared state.
// R – Repeatable:  Deterministic mocks with fixed return values.
// S – Self-validating: Every test has a FluentAssertions .Should() call or exception check.
// T – Timely:      Tests cover only code changed in this pipeline run (BUG-016, BUG-017).

using AiTicketHub.Application.Import;
using AiTicketHub.Application.Interfaces;
using AiTicketHub.Application.Services;
using AiTicketHub.Domain.Common;
using AiTicketHub.Domain.Entities;
using AiTicketHub.Domain.Enums;
using FluentAssertions;
using Moq;
using NUnit.Framework;

namespace AiTicketHub.Tests.Application;

[TestFixture]
public class TicketImportServiceBugFixTests
{
    private Mock<ICsvTicketParser>  _csvMock  = null!;
    private Mock<IJsonTicketParser> _jsonMock = null!;
    private Mock<IXmlTicketParser>  _xmlMock  = null!;
    private Mock<ITicketRepository> _repoMock = null!;
    private TicketImportService     _service  = null!;

    [SetUp]
    public void SetUp()
    {
        _csvMock  = new Mock<ICsvTicketParser>();
        _jsonMock = new Mock<IJsonTicketParser>();
        _xmlMock  = new Mock<IXmlTicketParser>();
        _repoMock = new Mock<ITicketRepository>();

        _service = new TicketImportService(
            _csvMock.Object,
            _jsonMock.Object,
            _xmlMock.Object,
            _repoMock.Object);
    }

    private static TicketImportRecord MakeRecord() =>
        new("cust-1", "a@b.com", "Alice", "Subject", "Long description",
            TicketCategory.Other, TicketPriority.Medium,
            null, null, null, null, null, null);

    // ── BUG-016: ImportAsync null-format guard ─────────────────────────────

    [Test]
    public void ImportAsync_NullFormat_ThrowsArgumentNullException()
    {
        Func<Task> act = () => _service.ImportAsync(Stream.Null, null!);
        act.Should().ThrowAsync<ArgumentNullException>();
    }

    // ── BUG-017: Bulk-insert error row number is 1-based within parsed records ─
    // Scenario: 1 parse error (row 2) + 1 parsed record that fails bulk insert.
    // Old code: bulkError.RowNumber = parseErrors.Count + i + 1 = 1 + 0 + 1 = 2.
    // Fixed code: bulkError.RowNumber = i + 1 = 1.

    [Test]
    public async Task ImportAsync_BulkInsertFailureWithPriorParseError_BulkErrorRowNumberIsOneNotTwo()
    {
        _csvMock.Setup(p => p.ParseAsync(It.IsAny<Stream>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new ParseResult<TicketImportRecord>(
                    Records: new List<TicketImportRecord> { MakeRecord() },
                    Errors:  new List<ParseRowError>   { new ParseRowError(2, "Missing required field.") }));

        _repoMock.Setup(r => r.BulkAddAsync(It.IsAny<IReadOnlyList<Ticket>>()))
                 .ReturnsAsync((IReadOnlyList<Result<Ticket>>)new List<Result<Ticket>>
                 {
                     Result<Ticket>.Failure(Errors.TicketDuplicate)
                 });

        var response = await _service.ImportAsync(Stream.Null, "csv");

        // Two errors total: one from parsing, one from bulk insert.
        response.Errors.Should().HaveCount(2);

        // Parse error keeps its original row number (2).
        response.Errors.Should().Contain(e => e.RowNumber == 2);

        // Bulk-insert error must be row 1 (position within parsed records), NOT row 2.
        response.Errors.Should().Contain(e => e.RowNumber == 1);
    }

    [Test]
    public async Task ImportAsync_AllRecordsInsertedSuccessfully_ReportsZeroErrors()
    {
        _csvMock.Setup(p => p.ParseAsync(It.IsAny<Stream>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new ParseResult<TicketImportRecord>(
                    Records: new List<TicketImportRecord> { MakeRecord() },
                    Errors:  new List<ParseRowError>()));

        _repoMock.Setup(r => r.BulkAddAsync(It.IsAny<IReadOnlyList<Ticket>>()))
                 .ReturnsAsync((IReadOnlyList<Ticket> tickets) =>
                     (IReadOnlyList<Result<Ticket>>)tickets
                         .Select(t => Result<Ticket>.Success(t))
                         .ToList());

        var response = await _service.ImportAsync(Stream.Null, "csv");

        response.Errors.Should().BeEmpty();
        response.Successful.Should().Be(1);
        response.Failed.Should().Be(0);
    }
}
