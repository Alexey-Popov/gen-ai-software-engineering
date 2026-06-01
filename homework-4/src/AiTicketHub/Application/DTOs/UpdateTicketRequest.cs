// src/AiTicketHub/Application/DTOs/UpdateTicketRequest.cs
using AiTicketHub.Domain.Enums;

namespace AiTicketHub.Application.DTOs;

public record UpdateTicketRequest(
    string? Subject,
    string? Description,
    TicketCategory? Category,
    TicketPriority? Priority,
    TicketStatus? Status,
    string? AssignedTo,
    List<string>? Tags,
    string? Browser,
    DeviceType? DeviceType
);
