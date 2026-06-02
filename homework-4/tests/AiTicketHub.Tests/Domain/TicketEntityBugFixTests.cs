// tests/AiTicketHub.Tests/Domain/TicketEntityBugFixTests.cs
// FIRST compliance:
// F – Fast:        No I/O or sleep; pure in-memory domain object tests.
// I – Independent: Each test constructs its own Ticket; no shared mutable state.
// R – Repeatable:  No randomness or clocks relied upon for assertions.
// S – Self-validating: Every test has a FluentAssertions .Should() call or catches an exception.
// T – Timely:      Tests cover only code changed in this pipeline run (BUG-025, BUG-001, BUG-002).

using AiTicketHub.Domain.Entities;
using AiTicketHub.Domain.Enums;
using FluentAssertions;
using NUnit.Framework;

namespace AiTicketHub.Tests.Domain;

[TestFixture]
public class TicketEntityBugFixTests
{
    private static Ticket MakeTicket(
        string customerId    = "cust-1",
        string customerEmail = "a@b.com",
        string customerName  = "Alice",
        string subject       = "Subject",
        string description   = "Valid description text",
        TicketStatus status  = TicketStatus.New) =>
        new(Guid.NewGuid(),
            customerId, customerEmail, customerName,
            subject, description,
            TicketCategory.Other, TicketPriority.Medium, status,
            DateTime.UtcNow, DateTime.UtcNow, null, null, [],
            TicketSource.Api, null, DeviceType.Desktop);

    // ── BUG-025: Constructor null/whitespace guards ─────────────────────────

    [Test]
    public void Constructor_NullCustomerId_ThrowsArgumentException()
    {
        Action act = () => MakeTicket(customerId: null!);
        act.Should().Throw<ArgumentException>().WithParameterName("customerId");
    }

    [Test]
    public void Constructor_WhitespaceCustomerId_ThrowsArgumentException()
    {
        Action act = () => MakeTicket(customerId: "   ");
        act.Should().Throw<ArgumentException>().WithParameterName("customerId");
    }

    [Test]
    public void Constructor_NullCustomerEmail_ThrowsArgumentException()
    {
        Action act = () => MakeTicket(customerEmail: null!);
        act.Should().Throw<ArgumentException>().WithParameterName("customerEmail");
    }

    [Test]
    public void Constructor_NullCustomerName_ThrowsArgumentException()
    {
        Action act = () => MakeTicket(customerName: null!);
        act.Should().Throw<ArgumentException>().WithParameterName("customerName");
    }

    [Test]
    public void Constructor_NullSubject_ThrowsArgumentException()
    {
        Action act = () => MakeTicket(subject: null!);
        act.Should().Throw<ArgumentException>().WithParameterName("subject");
    }

    [Test]
    public void Constructor_NullDescription_ThrowsArgumentException()
    {
        Action act = () => MakeTicket(description: null!);
        act.Should().Throw<ArgumentException>().WithParameterName("description");
    }

    [Test]
    public void Constructor_WhitespaceDescription_ThrowsArgumentException()
    {
        Action act = () => MakeTicket(description: "   ");
        act.Should().Throw<ArgumentException>().WithParameterName("description");
    }

    // ── BUG-001: TransitionTo — added InProgress→Resolved and WaitingCustomer→Resolved ─

    [Test]
    public void TransitionTo_FromInProgressToResolved_Succeeds()
    {
        var ticket = MakeTicket(status: TicketStatus.InProgress);

        var result = ticket.TransitionTo(TicketStatus.Resolved);

        result.IsSuccess.Should().BeTrue();
        ticket.Status.Should().Be(TicketStatus.Resolved);
        ticket.ResolvedAt.Should().NotBeNull();
    }

    [Test]
    public void TransitionTo_FromWaitingCustomerToResolved_Succeeds()
    {
        var ticket = MakeTicket(status: TicketStatus.WaitingCustomer);

        var result = ticket.TransitionTo(TicketStatus.Resolved);

        result.IsSuccess.Should().BeTrue();
        ticket.Status.Should().Be(TicketStatus.Resolved);
        ticket.ResolvedAt.Should().NotBeNull();
    }

    [Test]
    public void TransitionTo_FromNewToResolved_Fails()
    {
        var ticket = MakeTicket(status: TicketStatus.New);

        var result = ticket.TransitionTo(TicketStatus.Resolved);

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be("Ticket.InvalidStatus");
        ticket.Status.Should().Be(TicketStatus.New);
    }

    [Test]
    public void TransitionTo_FromNewToInProgress_Succeeds()
    {
        var ticket = MakeTicket(status: TicketStatus.New);

        var result = ticket.TransitionTo(TicketStatus.InProgress);

        result.IsSuccess.Should().BeTrue();
        ticket.Status.Should().Be(TicketStatus.InProgress);
    }

    [Test]
    public void TransitionTo_FromResolvedToClosed_Succeeds()
    {
        var ticket = MakeTicket(status: TicketStatus.Resolved);

        var result = ticket.TransitionTo(TicketStatus.Closed);

        result.IsSuccess.Should().BeTrue();
        ticket.Status.Should().Be(TicketStatus.Closed);
    }

    // ── BUG-002: ApplyUpdate — empty strings must not overwrite existing values ─

    [Test]
    public void ApplyUpdate_EmptySubject_DoesNotChangeSubject()
    {
        var ticket = MakeTicket(subject: "Original Subject");

        ticket.ApplyUpdate(
            subject: "",
            description: null,
            category: null,
            priority: null,
            assignedTo: null,
            tags: null,
            browser: null,
            deviceType: null);

        ticket.Subject.Should().Be("Original Subject");
    }

    [Test]
    public void ApplyUpdate_EmptyDescription_DoesNotChangeDescription()
    {
        var ticket = MakeTicket(description: "Original Description Text");

        ticket.ApplyUpdate(
            subject: null,
            description: "",
            category: null,
            priority: null,
            assignedTo: null,
            tags: null,
            browser: null,
            deviceType: null);

        ticket.Description.Should().Be("Original Description Text");
    }

    [Test]
    public void ApplyUpdate_NonEmptySubject_UpdatesSubject()
    {
        var ticket = MakeTicket(subject: "Old Subject");

        ticket.ApplyUpdate(
            subject: "New Subject",
            description: null,
            category: null,
            priority: null,
            assignedTo: null,
            tags: null,
            browser: null,
            deviceType: null);

        ticket.Subject.Should().Be("New Subject");
    }
}
