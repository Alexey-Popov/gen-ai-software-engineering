// src/AiTicketHub/Application/DTOs/AutoClassifyRequest.cs
using AiTicketHub.Domain.Enums;

namespace AiTicketHub.Application.DTOs;

public record AutoClassifyRequest(
    TicketCategory? CategoryOverride = null,
    TicketPriority? PriorityOverride = null
);
