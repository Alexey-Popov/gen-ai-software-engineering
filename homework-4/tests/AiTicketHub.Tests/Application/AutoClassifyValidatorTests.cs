// tests/AiTicketHub.Tests/Application/AutoClassifyValidatorTests.cs
// FIRST compliance:
// F – Fast:        No I/O or sleep; pure validator invocations.
// I – Independent: Each test creates its own request; no shared mutable state.
// R – Repeatable:  Deterministic input; no randomness.
// S – Self-validating: Every test has a FluentAssertions .Should() call.
// T – Timely:      Tests cover only code changed in this pipeline run (BUG-009).

using AiTicketHub.Application.DTOs;
using AiTicketHub.Application.Validators;
using AiTicketHub.Domain.Enums;
using FluentAssertions;
using NUnit.Framework;

namespace AiTicketHub.Tests.Application;

[TestFixture]
public class AutoClassifyValidatorTests
{
    private AutoClassifyValidator _validator = null!;

    [SetUp]
    public void SetUp() => _validator = new AutoClassifyValidator();

    // ── BUG-009: IsInEnum rules for CategoryOverride and PriorityOverride ─

    [Test]
    public void Validate_NoOverrides_IsValid()
    {
        var result = _validator.Validate(new AutoClassifyRequest());

        result.IsValid.Should().BeTrue();
    }

    [Test]
    public void Validate_ValidCategoryOverride_IsValid()
    {
        var result = _validator.Validate(
            new AutoClassifyRequest(CategoryOverride: TicketCategory.BugReport));

        result.IsValid.Should().BeTrue();
    }

    [Test]
    public void Validate_ValidPriorityOverride_IsValid()
    {
        var result = _validator.Validate(
            new AutoClassifyRequest(PriorityOverride: TicketPriority.High));

        result.IsValid.Should().BeTrue();
    }

    [Test]
    public void Validate_InvalidCategoryOverride_FailsOnCategoryOverride()
    {
        var result = _validator.Validate(
            new AutoClassifyRequest(CategoryOverride: (TicketCategory)999));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "CategoryOverride");
    }

    [Test]
    public void Validate_InvalidPriorityOverride_FailsOnPriorityOverride()
    {
        var result = _validator.Validate(
            new AutoClassifyRequest(PriorityOverride: (TicketPriority)999));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "PriorityOverride");
    }

    [Test]
    public void Validate_BothValidOverrides_IsValid()
    {
        var result = _validator.Validate(
            new AutoClassifyRequest(
                CategoryOverride: TicketCategory.TechnicalIssue,
                PriorityOverride: TicketPriority.Urgent));

        result.IsValid.Should().BeTrue();
    }

    [Test]
    public void Validate_BothInvalidOverrides_FailsOnBoth()
    {
        var result = _validator.Validate(
            new AutoClassifyRequest(
                CategoryOverride: (TicketCategory)999,
                PriorityOverride: (TicketPriority)999));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "CategoryOverride");
        result.Errors.Should().Contain(e => e.PropertyName == "PriorityOverride");
    }
}
