// tests/AiTicketHub.Tests/Application/CreateTicketValidatorTests.cs
using AiTicketHub.Application.DTOs;
using AiTicketHub.Application.Validators;
using AiTicketHub.Domain.Enums;
using FluentAssertions;
using NUnit.Framework;

namespace AiTicketHub.Tests.Application;

[TestFixture]
public class CreateTicketValidatorTests
{
    private CreateTicketValidator _validator = null!;

    [SetUp]
    public void SetUp() => _validator = new CreateTicketValidator();

    private static CreateTicketRequest ValidRequest() =>
        new("cust-1", "alice@example.com", "Alice",
            "Valid subject", "Valid description text",
            TicketCategory.Other, TicketPriority.Medium,
            TicketSource.Api, DeviceType.Desktop, [], null, null);

    [Test]
    public void Validate_ValidRequest_IsValid()
    {
        var result = _validator.Validate(ValidRequest());

        result.IsValid.Should().BeTrue();
    }

    [Test]
    public void Validate_EmptyCustomerId_FailsOnCustomerId()
    {
        var result = _validator.Validate(ValidRequest() with { CustomerId = "" });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.PropertyName == "CustomerId");
    }

    [Test]
    public void Validate_EmptyCustomerEmail_FailsOnCustomerEmail()
    {
        var result = _validator.Validate(ValidRequest() with { CustomerEmail = "" });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "CustomerEmail");
    }

    [Test]
    public void Validate_InvalidEmailFormat_FailsOnCustomerEmail()
    {
        var result = _validator.Validate(ValidRequest() with { CustomerEmail = "not-an-email" });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.PropertyName == "CustomerEmail");
    }

    [Test]
    public void Validate_EmptyCustomerName_FailsOnCustomerName()
    {
        var result = _validator.Validate(ValidRequest() with { CustomerName = "" });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.PropertyName == "CustomerName");
    }

    [Test]
    public void Validate_EmptySubject_FailsOnSubject()
    {
        var result = _validator.Validate(ValidRequest() with { Subject = "" });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Subject");
    }

    [Test]
    public void Validate_SubjectAtMaxLength_IsValid()
    {
        var result = _validator.Validate(ValidRequest() with { Subject = new string('x', 200) });

        result.IsValid.Should().BeTrue();
    }

    [Test]
    public void Validate_SubjectExceedsMaxLength_FailsOnSubject()
    {
        var result = _validator.Validate(ValidRequest() with { Subject = new string('x', 201) });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.PropertyName == "Subject");
    }

    [Test]
    public void Validate_EmptyDescription_FailsOnDescription()
    {
        var result = _validator.Validate(ValidRequest() with { Description = "" });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Description");
    }

    [Test]
    public void Validate_DescriptionAtMinLength_IsValid()
    {
        var result = _validator.Validate(ValidRequest() with { Description = new string('x', 10) });

        result.IsValid.Should().BeTrue();
    }

    [Test]
    public void Validate_DescriptionBelowMinLength_FailsOnDescription()
    {
        var result = _validator.Validate(ValidRequest() with { Description = new string('x', 9) });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.PropertyName == "Description");
    }

    [Test]
    public void Validate_DescriptionAtMaxLength_IsValid()
    {
        var result = _validator.Validate(ValidRequest() with { Description = new string('x', 2000) });

        result.IsValid.Should().BeTrue();
    }

    [Test]
    public void Validate_DescriptionExceedsMaxLength_FailsOnDescription()
    {
        var result = _validator.Validate(ValidRequest() with { Description = new string('x', 2001) });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.PropertyName == "Description");
    }

    [Test]
    public void Validate_NullTags_FailsOnTags()
    {
        var result = _validator.Validate(ValidRequest() with { Tags = null! });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.PropertyName == "Tags");
    }
}
