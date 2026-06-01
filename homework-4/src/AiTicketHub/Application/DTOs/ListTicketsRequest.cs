// src/AiTicketHub/Application/DTOs/ListTicketsRequest.cs
using AiTicketHub.Domain.Enums;

namespace AiTicketHub.Application.DTOs;

public record ListTicketsRequest(
    TicketCategory? Category,
    TicketPriority? Priority,
    TicketStatus? Status,
    string? AssignedTo,
    int Page,
    int PageSize
);
