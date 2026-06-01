// src/AiTicketHub/Application/DTOs/CreateTicketRequest.cs
using AiTicketHub.Domain.Enums;

namespace AiTicketHub.Application.DTOs;

public record CreateTicketRequest(
    string CustomerId,
    string CustomerEmail,
    string CustomerName,
    string Subject,
    string Description,
    TicketCategory Category,
    TicketPriority Priority,
    TicketSource Source,
    DeviceType DeviceType,
    List<string> Tags,
    string? AssignedTo,
    string? Browser,
    bool AutoClassify = false
);
