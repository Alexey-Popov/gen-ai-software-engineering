// tests/AiTicketHub.Tests/Infrastructure/TicketRepositoryTests.cs
using AiTicketHub.Domain.Entities;
using AiTicketHub.Domain.Enums;
using AiTicketHub.Infrastructure.Repositories;
using FluentAssertions;
using NUnit.Framework;

namespace AiTicketHub.Tests.Infrastructure;

[TestFixture]
public class TicketRepositoryTests
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

    // ── AddAsync ────────────────────────────────────────────────────────────

    [Test]
    public async Task AddAsync_NewTicket_ReturnsSuccess()
    {
        var ticket = MakeTicket();

        var result = await _repo.AddAsync(ticket);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(ticket.Id);
    }

    [Test]
    public async Task AddAsync_DuplicateId_ReturnsDuplicateError()
    {
        var ticket = MakeTicket();
        await _repo.AddAsync(ticket);

        var result = await _repo.AddAsync(ticket);

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be("Ticket.Duplicate");
    }

    // ── GetByIdAsync ────────────────────────────────────────────────────────

    [Test]
    public async Task GetByIdAsync_ExistingId_ReturnsTicket()
    {
        var ticket = MakeTicket();
        await _repo.AddAsync(ticket);

        var result = await _repo.GetByIdAsync(ticket.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(ticket.Id);
    }

    [Test]
    public async Task GetByIdAsync_UnknownId_ReturnsNotFoundError()
    {
        var result = await _repo.GetByIdAsync(Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be("Ticket.NotFound");
    }

    // ── GetAllAsync ─────────────────────────────────────────────────────────

    [Test]
    public async Task GetAllAsync_EmptyStore_ReturnsEmptyList()
    {
        var result = await _repo.GetAllAsync();

        result.IsSuccess.Should().BeTrue();
        result.Value!.Should().BeEmpty();
    }

    [Test]
    public async Task GetAllAsync_AfterAddingTwo_ReturnsBothTickets()
    {
        await _repo.AddAsync(MakeTicket());
        await _repo.AddAsync(MakeTicket());

        var result = await _repo.GetAllAsync();

        result.IsSuccess.Should().BeTrue();
        result.Value!.Should().HaveCount(2);
    }

    // ── UpdateAsync ─────────────────────────────────────────────────────────

    [Test]
    public async Task UpdateAsync_ExistingTicket_ReturnsUpdatedTicket()
    {
        var ticket = MakeTicket();
        await _repo.AddAsync(ticket);

        var result = await _repo.UpdateAsync(ticket);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(ticket.Id);
    }

    [Test]
    public async Task UpdateAsync_UnknownId_ReturnsNotFoundError()
    {
        var result = await _repo.UpdateAsync(MakeTicket());

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be("Ticket.NotFound");
    }

    // ── DeleteAsync ─────────────────────────────────────────────────────────

    [Test]
    public async Task DeleteAsync_ExistingId_ReturnsSuccess()
    {
        var ticket = MakeTicket();
        await _repo.AddAsync(ticket);

        var result = await _repo.DeleteAsync(ticket.Id);

        result.IsSuccess.Should().BeTrue();
    }

    [Test]
    public async Task DeleteAsync_UnknownId_ReturnsNotFoundError()
    {
        var result = await _repo.DeleteAsync(Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be("Ticket.NotFound");
    }

    // ── BulkAddAsync ────────────────────────────────────────────────────────

    [Test]
    public async Task BulkAddAsync_AllNewTickets_AllResultsSuccess()
    {
        var tickets = new List<Ticket> { MakeTicket(), MakeTicket() };

        var results = await _repo.BulkAddAsync(tickets);

        results.Should().AllSatisfy(r => r.IsSuccess.Should().BeTrue());
    }

    [Test]
    public async Task BulkAddAsync_DuplicateTicket_DuplicateResultHasDuplicateError()
    {
        var ticket = MakeTicket();
        await _repo.AddAsync(ticket);

        var results = await _repo.BulkAddAsync([ticket]);

        results.Should().ContainSingle();
        results[0].IsSuccess.Should().BeFalse();
        results[0].Error!.Code.Should().Be("Ticket.Duplicate");
    }

    // ── UpdateClassificationAsync ───────────────────────────────────────────

    [Test]
    public async Task UpdateClassificationAsync_ExistingTicket_ReturnsUpdatedClassification()
    {
        var ticket = MakeTicket();
        await _repo.AddAsync(ticket);

        var result = await _repo.UpdateClassificationAsync(ticket.Id, TicketCategory.BugReport, TicketPriority.High);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Category.Should().Be(TicketCategory.BugReport);
        result.Value.Priority.Should().Be(TicketPriority.High);
    }

    [Test]
    public async Task UpdateClassificationAsync_UnknownId_ReturnsNotFoundError()
    {
        var result = await _repo.UpdateClassificationAsync(Guid.NewGuid(), TicketCategory.BugReport, TicketPriority.High);

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be("Ticket.NotFound");
    }

    // ── Concurrency ─────────────────────────────────────────────────────────

    [Test]
    public async Task AddAsync_ConcurrentAddsWithSameId_ExactlyOneSucceeds()
    {
        var ticket = MakeTicket();

        var results = await Task.WhenAll(
            Task.Run(() => _repo.AddAsync(ticket)),
            Task.Run(() => _repo.AddAsync(ticket)));

        results.Count(r => r.IsSuccess).Should().Be(1);
        results.Count(r => !r.IsSuccess).Should().Be(1);
    }

    [Test]
    public async Task DeleteAsync_ConcurrentDeletesSameId_ExactlyOneSucceeds()
    {
        var ticket = MakeTicket();
        await _repo.AddAsync(ticket);

        var results = await Task.WhenAll(
            Task.Run(() => _repo.DeleteAsync(ticket.Id)),
            Task.Run(() => _repo.DeleteAsync(ticket.Id)));

        results.Count(r => r.IsSuccess).Should().Be(1);
        results.Count(r => !r.IsSuccess).Should().Be(1);
    }
}
