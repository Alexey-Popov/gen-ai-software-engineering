using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using Xunit;
using TicketManagementApi.Models;

namespace TicketManagementApi.Tests;

public class TicketModelTests
{
    private List<ValidationResult> ValidateModel(object model)
    {
        var context = new ValidationContext(model);
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(model, context, results, true);
        return results;
    }

    [Fact]
    public void CreateTicketDto_ValidModel_PassesValidation()
    {
        // Arrange
        var dto = new CreateTicketDto
        {
            CustomerId = "C1",
            CustomerEmail = "test@example.com",
            CustomerName = "John Doe",
            Subject = "Test Subject",
            Description = "This is a descriptive ticket description.",
            Metadata = new CreateTicketMetadataDto
            {
                Source = TicketSource.web_form,
                DeviceType = DeviceType.desktop
            }
        };

        // Act
        var errors = ValidateModel(dto);

        // Assert
        Assert.Empty(errors);
    }

    [Fact]
    public void CreateTicketDto_MissingCustomerId_FailsValidation()
    {
        var dto = new CreateTicketDto
        {
            CustomerId = "", // Missing
            CustomerEmail = "test@example.com",
            CustomerName = "John Doe",
            Subject = "Test Subject",
            Description = "This is a descriptive ticket description.",
            Metadata = new CreateTicketMetadataDto
            {
                Source = TicketSource.web_form,
                DeviceType = DeviceType.desktop
            }
        };

        var errors = ValidateModel(dto);

        Assert.Contains(errors, e => e.ErrorMessage != null && e.ErrorMessage.Contains("customer_id is required"));
    }

    [Fact]
    public void CreateTicketDto_InvalidEmail_FailsValidation()
    {
        var dto = new CreateTicketDto
        {
            CustomerId = "C1",
            CustomerEmail = "invalid-email", // Invalid
            CustomerName = "John Doe",
            Subject = "Test Subject",
            Description = "This is a descriptive ticket description.",
            Metadata = new CreateTicketMetadataDto
            {
                Source = TicketSource.web_form,
                DeviceType = DeviceType.desktop
            }
        };

        var errors = ValidateModel(dto);

        Assert.Contains(errors, e => e.ErrorMessage != null && e.ErrorMessage.Contains("customer_email must be a valid email address"));
    }

    [Fact]
    public void CreateTicketDto_MissingCustomerName_FailsValidation()
    {
        var dto = new CreateTicketDto
        {
            CustomerId = "C1",
            CustomerEmail = "test@example.com",
            CustomerName = "", // Missing
            Subject = "Test Subject",
            Description = "This is a descriptive ticket description.",
            Metadata = new CreateTicketMetadataDto
            {
                Source = TicketSource.web_form,
                DeviceType = DeviceType.desktop
            }
        };

        var errors = ValidateModel(dto);

        Assert.Contains(errors, e => e.ErrorMessage != null && e.ErrorMessage.Contains("customer_name is required"));
    }

    [Fact]
    public void CreateTicketDto_SubjectTooLong_FailsValidation()
    {
        var dto = new CreateTicketDto
        {
            CustomerId = "C1",
            CustomerEmail = "test@example.com",
            CustomerName = "John Doe",
            Subject = new string('a', 201), // Max is 200
            Description = "This is a descriptive ticket description.",
            Metadata = new CreateTicketMetadataDto
            {
                Source = TicketSource.web_form,
                DeviceType = DeviceType.desktop
            }
        };

        var errors = ValidateModel(dto);

        Assert.Contains(errors, e => e.ErrorMessage != null && e.ErrorMessage.Contains("subject must be between 1 and 200 characters"));
    }

    [Fact]
    public void CreateTicketDto_SubjectEmpty_FailsValidation()
    {
        var dto = new CreateTicketDto
        {
            CustomerId = "C1",
            CustomerEmail = "test@example.com",
            CustomerName = "John Doe",
            Subject = "", // Empty
            Description = "This is a descriptive ticket description.",
            Metadata = new CreateTicketMetadataDto
            {
                Source = TicketSource.web_form,
                DeviceType = DeviceType.desktop
            }
        };

        var errors = ValidateModel(dto);

        Assert.Contains(errors, e => e.ErrorMessage != null && e.ErrorMessage.Contains("subject is required"));
    }

    [Fact]
    public void CreateTicketDto_DescriptionTooShort_FailsValidation()
    {
        var dto = new CreateTicketDto
        {
            CustomerId = "C1",
            CustomerEmail = "test@example.com",
            CustomerName = "John Doe",
            Subject = "Test Subject",
            Description = "short", // Min is 10
            Metadata = new CreateTicketMetadataDto
            {
                Source = TicketSource.web_form,
                DeviceType = DeviceType.desktop
            }
        };

        var errors = ValidateModel(dto);

        Assert.Contains(errors, e => e.ErrorMessage != null && e.ErrorMessage.Contains("description must be between 10 and 2000 characters"));
    }

    [Fact]
    public void CreateTicketDto_DescriptionTooLong_FailsValidation()
    {
        var dto = new CreateTicketDto
        {
            CustomerId = "C1",
            CustomerEmail = "test@example.com",
            CustomerName = "John Doe",
            Subject = "Test Subject",
            Description = new string('a', 2001), // Max is 2000
            Metadata = new CreateTicketMetadataDto
            {
                Source = TicketSource.web_form,
                DeviceType = DeviceType.desktop
            }
        };

        var errors = ValidateModel(dto);

        Assert.Contains(errors, e => e.ErrorMessage != null && e.ErrorMessage.Contains("description must be between 10 and 2000 characters"));
    }

    [Fact]
    public void CreateTicketDto_MissingMetadata_FailsValidation()
    {
        var dto = new CreateTicketDto
        {
            CustomerId = "C1",
            CustomerEmail = "test@example.com",
            CustomerName = "John Doe",
            Subject = "Test Subject",
            Description = "This is a descriptive ticket description.",
            Metadata = null! // Missing
        };

        var errors = ValidateModel(dto);

        Assert.Contains(errors, e => e.ErrorMessage != null && e.ErrorMessage.Contains("metadata is required"));
    }
}
