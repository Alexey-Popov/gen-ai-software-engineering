// src/AiTicketHub/Application/DTOs/ClassificationResult.cs
using AiTicketHub.Domain.Enums;

namespace AiTicketHub.Application.DTOs;

public record ClassificationResult(
    TicketCategory  Category,
    TicketPriority  Priority,
    double          Confidence,
    string          Reasoning,
    List<string>    KeywordsFound
);
