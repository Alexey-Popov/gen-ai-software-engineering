// src/AiTicketHub/Application/DTOs/AutoClassifyResponse.cs
using AiTicketHub.Domain.Enums;

namespace AiTicketHub.Application.DTOs;

public record AutoClassifyResponse(
    TicketCategory  Category,
    TicketPriority  Priority,
    double          Confidence,
    string          Reasoning,
    List<string>    KeywordsFound
);
