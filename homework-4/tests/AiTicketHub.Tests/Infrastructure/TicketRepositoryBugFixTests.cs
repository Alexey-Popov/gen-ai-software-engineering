// tests/AiTicketHub.Tests/Infrastructure/TicketRepositoryBugFixTests.cs
// FIRST compliance:
// F – Fast:        No I/O or sleep; all operations are in-memory.
// I – Independent: Each test creates a fresh TicketRepository via SetUp; no shared state.
// R – Repeatable:  Deterministic; no randomness or time-dependent assertions.
// S – Self-validating: Every test has a FluentAssertions .Should() call or checks exception.
// T – Timely:      Tests cover only code changed in this pipeline run (BUG-029, BUG-021).

using AiTicketHub.Domain.Entities;
using AiTicketHub.Domain.Enums;
using AiTicketHub.Infrastructure.Repositories;
using FluentAssertions;
using NUnit.Framework;

namespace AiTicketHub.Tests.Infrastructure;

[TestFixture]
public class TicketRepositoryBugFixTests
{
    private TicketRepository _repo = null!;

    [SetUp]
    public void SetUp() => _repo = new TicketRepository();

    private static Ticket MakeTicket(Guid? id = null) =>
        new(id ?? Guid.NewGuid(),
            "cust-1", "a@b.com", "Alice",
            "Subject", "Valid description text",
            TicketCategory.Other, TicketPriority.Medium, TicketStatus.New,
            DateTime.UtcNow, DateTime.UtcNow, null, null, [],
            TicketSource.Api, null, DeviceType.Desktop);

    // ── BUG-029: AddAsync null-ticket guard ───────────────────────────────

    [Test]
    public void AddAsync_NullTicket_ThrowsArgumentNullException()
    {
        Func<Task> act = () => _repo.AddAsync(null!);
        act.Should().ThrowAsync<ArgumentNullException>();
    }

    // ── BUG-021: BulkAddAsync null-list and null-element guards ───────────

    [Test]
    public void BulkAddAsync_NullList_ThrowsArgumentNullException()
    {
        Func<Task> act = () => _repo.BulkAddAsync(null!);
        act.Should().ThrowAsync<ArgumentNullException>();
    }

    [Test]
    public async Task BulkAddAsync_ListContainingNullElement_ReturnsInvalidErrorForNullSlot()
    {
        var tickets = new List<Ticket> { null! };

        var results = await _repo.BulkAddAsync(tickets);

        results.Should().HaveCount(1);
        results[0].IsSuccess.Should().BeFalse();
        results[0].Error!.Code.Should().Be("Ticket.Invalid");
    }

    [Test]
    public async Task BulkAddAsync_MixedNullAndValidTickets_NullSlotFailsValidSucceeds()
    {
        var valid = MakeTicket();
        var tickets = new List<Ticket> { null!, valid };

        var results = await _repo.BulkAddAsync(tickets);

        results.Should().HaveCount(2);
        results[0].IsSuccess.Should().BeFalse();
        results[0].Error!.Code.Should().Be("Ticket.Invalid");
        results[1].IsSuccess.Should().BeTrue();
    }
}
