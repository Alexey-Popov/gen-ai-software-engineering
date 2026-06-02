// src/AiTicketHub/Application/Validators/AutoClassifyValidator.cs
using AiTicketHub.Application.DTOs;
using FluentValidation;

namespace AiTicketHub.Application.Validators;

public class AutoClassifyValidator : AbstractValidator<AutoClassifyRequest>
{
    public AutoClassifyValidator()
    {
        RuleFor(x => x.CategoryOverride)
            .IsInEnum().WithMessage("Invalid ticket category.")
            .When(x => x.CategoryOverride.HasValue);

        RuleFor(x => x.PriorityOverride)
            .IsInEnum().WithMessage("Invalid ticket priority.")
            .When(x => x.PriorityOverride.HasValue);
    }
}
