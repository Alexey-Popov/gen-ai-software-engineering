// tests/AiTicketHub.Tests/Application/CreateTicketValidatorBugFixTests.cs
// FIRST compliance:
// F – Fast:        No I/O or sleep; pure validator invocations.
// I – Independent: Each test creates its own request; no shared mutable state.
// R – Repeatable:  Deterministic input; no randomness.
// S – Self-validating: Every test has a FluentAssertions .Should() call.
// T – Timely:      Tests cover only code changed in this pipeline run (BUG-026, BUG-019).

using AiTicketHub.Application.DTOs;
using AiTicketHub.Application.Validators;
using AiTicketHub.Domain.Enums;
using FluentAssertions;
using NUnit.Framework;

namespace AiTicketHub.Tests.Application;

[TestFixture]
public class CreateTicketValidatorBugFixTests
{
    private CreateTicketValidator _validator = null!;

    [SetUp]
    public void SetUp() => _validator = new CreateTicketValidator();

    private static CreateTicketRequest ValidRequest(List<string>? tags = null) =>
        new("cust-1", "alice@example.com", "Alice",
            "Valid subject", "Valid description text",
            TicketCategory.Other, TicketPriority.Medium,
            TicketSource.Api, DeviceType.Desktop,
            tags ?? [], null, null);

    // ── BUG-026 / BUG-019: Tag entries must not be empty or whitespace ────

    [Test]
    public void Validate_EmptyStringTagEntry_FailsOnTags()
    {
        var result = _validator.Validate(ValidRequest(["valid-tag", ""]));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName.StartsWith("Tags"));
    }

    [Test]
    public void Validate_WhitespaceOnlyTagEntry_FailsOnTags()
    {
        var result = _validator.Validate(ValidRequest(["valid-tag", "   "]));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName.StartsWith("Tags"));
    }

    [Test]
    public void Validate_AllValidTagEntries_IsValid()
    {
        var result = _validator.Validate(ValidRequest(["billing", "urgent", "api"]));

        result.IsValid.Should().BeTrue();
    }

    [Test]
    public void Validate_EmptyTagsList_IsValid()
    {
        var result = _validator.Validate(ValidRequest([]));

        result.IsValid.Should().BeTrue();
    }

    [Test]
    public void Validate_SingleWhitespaceTag_FailsOnTags()
    {
        var result = _validator.Validate(ValidRequest([" "]));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName.StartsWith("Tags"));
    }
}
