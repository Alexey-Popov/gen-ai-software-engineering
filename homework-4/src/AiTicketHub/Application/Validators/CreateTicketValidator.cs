// src/AiTicketHub/Application/Validators/CreateTicketValidator.cs
using AiTicketHub.Application.DTOs;
using FluentValidation;

namespace AiTicketHub.Application.Validators;

public class CreateTicketValidator : AbstractValidator<CreateTicketRequest>
{
    public CreateTicketValidator()
    {
        RuleFor(x => x.CustomerId)
            .NotEmpty().WithMessage("Customer ID is required.");

        RuleFor(x => x.CustomerEmail)
            .NotEmpty().WithMessage("Customer email is required.")
            .EmailAddress().WithMessage("Customer email must be a valid email address.");

        RuleFor(x => x.CustomerName)
            .NotEmpty().WithMessage("Customer name is required.");

        RuleFor(x => x.Subject)
            .NotEmpty().WithMessage("Subject is required.")
            .MaximumLength(200).WithMessage("Subject cannot exceed 200 characters.");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Description is required.")
            .MinimumLength(10).WithMessage("Description must be at least 10 characters.")
            .MaximumLength(2000).WithMessage("Description cannot exceed 2000 characters.");

        RuleFor(x => x.Category)
            .IsInEnum().WithMessage("Invalid ticket category.");

        RuleFor(x => x.Priority)
            .IsInEnum().WithMessage("Invalid ticket priority.");

        RuleFor(x => x.Source)
            .IsInEnum().WithMessage("Invalid ticket source.");

        RuleFor(x => x.DeviceType)
            .IsInEnum().WithMessage("Invalid device type.");

        RuleFor(x => x.Tags)
            .NotNull().WithMessage("Tags must not be null.");
        RuleForEach(x => x.Tags)
            .Must(t => !string.IsNullOrWhiteSpace(t)).WithMessage("Tag entries must not be empty or whitespace.")
            .When(x => x.Tags != null);
    }
}
