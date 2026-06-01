// src/AiTicketHub/Application/Validators/UpdateTicketValidator.cs
using AiTicketHub.Application.DTOs;
using FluentValidation;

namespace AiTicketHub.Application.Validators;

public class UpdateTicketValidator : AbstractValidator<UpdateTicketRequest>
{
    public UpdateTicketValidator()
    {
        RuleFor(x => x.Subject)
            .MaximumLength(200).WithMessage("Subject cannot exceed 200 characters.")
            .MinimumLength(1).WithMessage("Subject must be at least 1 character.")
            .When(x => x.Subject != null);

        RuleFor(x => x.Description)
            .MinimumLength(10).WithMessage("Description must be at least 10 characters.")
            .MaximumLength(2000).WithMessage("Description cannot exceed 2000 characters.")
            .When(x => x.Description != null);

        RuleFor(x => x.Category)
            .IsInEnum().WithMessage("Invalid ticket category.")
            .When(x => x.Category.HasValue);

        RuleFor(x => x.Priority)
            .IsInEnum().WithMessage("Invalid ticket priority.")
            .When(x => x.Priority.HasValue);

        RuleFor(x => x.Status)
            .IsInEnum().WithMessage("Invalid ticket status.")
            .When(x => x.Status.HasValue);

        RuleFor(x => x.DeviceType)
            .IsInEnum().WithMessage("Invalid device type.")
            .When(x => x.DeviceType.HasValue);
    }
}
