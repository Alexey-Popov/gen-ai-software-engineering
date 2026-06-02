// tests/AiTicketHub.Tests/Application/UpdateTicketValidatorBugFixTests.cs
// FIRST compliance:
// F – Fast:        No I/O or sleep; pure validator invocations.
// I – Independent: Each test creates its own request; no shared mutable state.
// R – Repeatable:  Deterministic input; no randomness.
// S – Self-validating: Every test has a FluentAssertions .Should() call.
// T – Timely:      Tests cover only code changed in this pipeline run (BUG-008).

using AiTicketHub.Application.DTOs;
using AiTicketHub.Application.Validators;
using FluentAssertions;
using NUnit.Framework;

namespace AiTicketHub.Tests.Application;

[TestFixture]
public class UpdateTicketValidatorBugFixTests
{
    private UpdateTicketValidator _validator = null!;

    [SetUp]
    public void SetUp() => _validator = new UpdateTicketValidator();

    private static UpdateTicketRequest AllNullRequest() =>
        new(null, null, null, null, null, null, null, null, null);

    // ── BUG-008: Whitespace-only Subject/Description must fail validation ──

    [Test]
    public void Validate_WhitespaceOnlySubject_FailsOnSubject()
    {
        var result = _validator.Validate(AllNullRequest() with { Subject = "   " });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Subject");
    }

    [Test]
    public void Validate_WhitespaceOnlyDescription_FailsOnDescription()
    {
        var result = _validator.Validate(AllNullRequest() with { Description = "   " });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Description");
    }

    [Test]
    public void Validate_SingleSpaceSubject_FailsOnSubject()
    {
        var result = _validator.Validate(AllNullRequest() with { Subject = " " });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Subject");
    }

    [Test]
    public void Validate_NullSubject_IsValid()
    {
        // Null subject means "no change requested" — should pass.
        var result = _validator.Validate(AllNullRequest() with { Subject = null });

        result.Errors.Should().NotContain(e => e.PropertyName == "Subject");
    }

    [Test]
    public void Validate_NullDescription_IsValid()
    {
        var result = _validator.Validate(AllNullRequest() with { Description = null });

        result.Errors.Should().NotContain(e => e.PropertyName == "Description");
    }
}
