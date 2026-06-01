// src/AiTicketHub/Application/DTOs/CreateTicketResponse.cs
using AiTicketHub.Domain.Enums;

namespace AiTicketHub.Application.DTOs;

public record CreateTicketResponse(
    Guid Id,
    string CustomerId,
    string CustomerEmail,
    string CustomerName,
    string Subject,
    string Description,
    TicketCategory Category,
    TicketPriority Priority,
    TicketStatus Status,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    DateTime? ResolvedAt,
    string? AssignedTo,
    List<string> Tags,
    TicketMetadata Metadata
);
