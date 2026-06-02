// tests/AiTicketHub.Tests/Application/TicketServiceBugFixTests.cs
// FIRST compliance:
// F – Fast:        No I/O or sleep; all repository/classifier calls are mocked.
// I – Independent: Each test gets a fresh mock and service via SetUp; no shared state.
// R – Repeatable:  All GUIDs created per-test; no time-dependent assertions.
// S – Self-validating: Every test has a FluentAssertions .Should() call or a Moq Verify.
// T – Timely:      Tests cover only code changed in this pipeline run (BUG-027, BUG-006, BUG-007, BUG-028, BUG-018).

using AiTicketHub.Application.DTOs;
using AiTicketHub.Application.Interfaces;
using AiTicketHub.Application.Services;
using AiTicketHub.Application.Validators;
using AiTicketHub.Domain.Common;
using AiTicketHub.Domain.Entities;
using AiTicketHub.Domain.Enums;
using FluentAssertions;
using Moq;
using NUnit.Framework;

namespace AiTicketHub.Tests.Application;

[TestFixture]
public class TicketServiceBugFixTests
{
    private Mock<ITicketRepository>      _repoMock       = null!;
    private Mock<IClassificationService> _classifierMock = null!;
    private Mock<ITicketImportService>   _importMock     = null!;
    private TicketService                _service        = null!;

    [SetUp]
    public void SetUp()
    {
        _repoMock       = new Mock<ITicketRepository>();
        _classifierMock = new Mock<IClassificationService>();
        _importMock     = new Mock<ITicketImportService>();

        _service = new TicketService(
            _repoMock.Object,
            new CreateTicketValidator(),
            new UpdateTicketValidator(),
            _importMock.Object,
            _classifierMock.Object);
    }

    private static Ticket MakeTicket(
        string subject      = "Subject",
        string description  = "Valid description text",
        TicketCategory cat  = TicketCategory.Other,
        TicketPriority pri  = TicketPriority.Medium,
        TicketStatus status = TicketStatus.New) =>
        new(Guid.NewGuid(), "cust-1", "a@b.com", "Alice",
            subject, description,
            cat, pri, status,
            DateTime.UtcNow, DateTime.UtcNow, null, null, [],
            TicketSource.Api, null, DeviceType.Desktop);

    private static CreateTicketRequest ValidCreateRequest(bool autoClassify = false) =>
        new("cust-1", "a@b.com", "Alice", "Valid subject", "Valid description text",
            TicketCategory.Other, TicketPriority.Medium, TicketSource.Api,
            DeviceType.Desktop, [], null, null, AutoClassify: autoClassify);

    // ── BUG-027: CreateTicketAsync null-request guard ──────────────────────

    [Test]
    public async Task CreateTicketAsync_NullRequest_ReturnsValidationFailed()
    {
        var result = await _service.CreateTicketAsync(null!);

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be("Validation.Failed");
        _repoMock.Verify(r => r.AddAsync(It.IsAny<Ticket>()), Times.Never);
    }

    // ── BUG-006: CreateTicketAsync with AutoClassify=true persists via UpdateAsync ─

    [Test]
    public async Task CreateTicketAsync_AutoClassifyTrue_CallsUpdateAsyncToPersistClassification()
    {
        var request = ValidCreateRequest(autoClassify: true);

        _repoMock.Setup(r => r.AddAsync(It.IsAny<Ticket>()))
                 .ReturnsAsync((Ticket t) => Result<Ticket>.Success(t));
        _repoMock.Setup(r => r.UpdateAsync(It.IsAny<Ticket>()))
                 .ReturnsAsync((Ticket t) => Result<Ticket>.Success(t));
        _classifierMock.Setup(c => c.Classify(It.IsAny<string>(), It.IsAny<string>()))
                       .Returns(new ClassificationResult(
                           TicketCategory.AccountAccess, TicketPriority.Urgent,
                           0.3, "Matched login", ["login"]));

        var result = await _service.CreateTicketAsync(request);

        result.IsSuccess.Should().BeTrue();
        _repoMock.Verify(r => r.UpdateAsync(It.IsAny<Ticket>()), Times.Once);
    }

    [Test]
    public async Task CreateTicketAsync_AutoClassifyFalse_NeverCallsUpdateAsync()
    {
        var request = ValidCreateRequest(autoClassify: false);

        _repoMock.Setup(r => r.AddAsync(It.IsAny<Ticket>()))
                 .ReturnsAsync((Ticket t) => Result<Ticket>.Success(t));

        var result = await _service.CreateTicketAsync(request);

        result.IsSuccess.Should().BeTrue();
        _repoMock.Verify(r => r.UpdateAsync(It.IsAny<Ticket>()), Times.Never);
    }

    // ── BUG-007: ListTicketsAsync total reflects filtered count, not all-tickets count ─

    [Test]
    public async Task ListTicketsAsync_FilterApplied_TotalCountReflectsFilteredCount()
    {
        var t1 = MakeTicket(cat: TicketCategory.AccountAccess);
        var t2 = MakeTicket(cat: TicketCategory.AccountAccess);
        var t3 = MakeTicket(cat: TicketCategory.BillingQuestion);

        _repoMock.Setup(r => r.GetAllAsync())
                 .ReturnsAsync(Result<IReadOnlyList<Ticket>>.Success(
                     new List<Ticket> { t1, t2, t3 }));

        var result = await _service.ListTicketsAsync(
            new ListTicketsRequest(TicketCategory.AccountAccess, null, null, null, 1, 20));

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(2);
        result.Value.Items.Should().HaveCount(2);
    }

    [Test]
    public async Task ListTicketsAsync_NoFilter_TotalCountEqualsAllTickets()
    {
        var tickets = Enumerable.Range(1, 4)
            .Select(_ => MakeTicket())
            .ToList();
        _repoMock.Setup(r => r.GetAllAsync())
                 .ReturnsAsync(Result<IReadOnlyList<Ticket>>.Success(tickets));

        var result = await _service.ListTicketsAsync(
            new ListTicketsRequest(null, null, null, null, 1, 20));

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(4);
    }

    // ── BUG-028: UpdateTicketAsync null-request guard ──────────────────────

    [Test]
    public async Task UpdateTicketAsync_NullRequest_ReturnsValidationFailed()
    {
        var result = await _service.UpdateTicketAsync(Guid.NewGuid(), null!);

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be("Validation.Failed");
        _repoMock.Verify(r => r.GetByIdAsync(It.IsAny<Guid>()), Times.Never);
    }

    // ── BUG-018: AutoClassifyAsync null request defaults to new AutoClassifyRequest() ─

    [Test]
    public async Task AutoClassifyAsync_NullRequest_DoesNotThrowAndReturnsSuccess()
    {
        var ticket = MakeTicket();

        _repoMock.Setup(r => r.GetByIdAsync(ticket.Id))
                 .ReturnsAsync(Result<Ticket>.Success(ticket));
        _classifierMock.Setup(c => c.Classify(It.IsAny<string>(), It.IsAny<string>()))
                       .Returns(new ClassificationResult(
                           TicketCategory.Other, TicketPriority.Medium,
                           0.0, "No keywords matched", []));
        _repoMock.Setup(r => r.UpdateClassificationAsync(
                     ticket.Id, TicketCategory.Other, TicketPriority.Medium))
                 .ReturnsAsync(Result<Ticket>.Success(ticket));

        Func<Task> act = () => _service.AutoClassifyAsync(ticket.Id, null!);

        await act.Should().NotThrowAsync();

        var result = await _service.AutoClassifyAsync(ticket.Id, null!);
        result.IsSuccess.Should().BeTrue();
    }
}
