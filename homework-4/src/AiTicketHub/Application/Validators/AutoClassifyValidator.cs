// src/AiTicketHub/Application/Validators/AutoClassifyValidator.cs
using AiTicketHub.Application.DTOs;
using FluentValidation;

namespace AiTicketHub.Application.Validators;

public class AutoClassifyValidator : AbstractValidator<AutoClassifyRequest>
{
    public AutoClassifyValidator() { }
}
