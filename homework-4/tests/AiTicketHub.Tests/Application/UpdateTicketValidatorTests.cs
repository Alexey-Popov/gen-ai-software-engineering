// tests/AiTicketHub.Tests/Application/UpdateTicketValidatorTests.cs
using AiTicketHub.Application.DTOs;
using AiTicketHub.Application.Validators;
using FluentAssertions;
using NUnit.Framework;

namespace AiTicketHub.Tests.Application;

[TestFixture]
public class UpdateTicketValidatorTests
{
    private UpdateTicketValidator _validator = null!;

    [SetUp]
    public void SetUp() => _validator = new UpdateTicketValidator();

    private static UpdateTicketRequest AllNullRequest() =>
        new(null, null, null, null, null, null, null, null, null);

    [Test]
    public void Validate_AllNullOptionals_IsValid()
    {
        var result = _validator.Validate(AllNullRequest());

        result.IsValid.Should().BeTrue();
    }

    [Test]
    public void Validate_SubjectAtMaxLength_IsValid()
    {
        var result = _validator.Validate(AllNullRequest() with { Subject = new string('x', 200) });

        result.IsValid.Should().BeTrue();
    }

    [Test]
    public void Validate_SubjectExceedsMaxLength_FailsOnSubject()
    {
        var result = _validator.Validate(AllNullRequest() with { Subject = new string('x', 201) });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.PropertyName == "Subject");
    }

    [Test]
    public void Validate_SubjectAtMinLength_IsValid()
    {
        var result = _validator.Validate(AllNullRequest() with { Subject = "x" });

        result.IsValid.Should().BeTrue();
    }

    [Test]
    public void Validate_SubjectEmptyWhenPresent_FailsOnSubject()
    {
        var result = _validator.Validate(AllNullRequest() with { Subject = "" });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.PropertyName == "Subject");
    }

    [Test]
    public void Validate_DescriptionAtMinLength_IsValid()
    {
        var result = _validator.Validate(AllNullRequest() with { Description = new string('x', 10) });

        result.IsValid.Should().BeTrue();
    }

    [Test]
    public void Validate_DescriptionBelowMinLength_FailsOnDescription()
    {
        var result = _validator.Validate(AllNullRequest() with { Description = new string('x', 9) });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.PropertyName == "Description");
    }

    [Test]
    public void Validate_DescriptionAtMaxLength_IsValid()
    {
        var result = _validator.Validate(AllNullRequest() with { Description = new string('x', 2000) });

        result.IsValid.Should().BeTrue();
    }

    [Test]
    public void Validate_DescriptionExceedsMaxLength_FailsOnDescription()
    {
        var result = _validator.Validate(AllNullRequest() with { Description = new string('x', 2001) });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.PropertyName == "Description");
    }
}
