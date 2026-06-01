// src/AiTicketHub/Application/DTOs/TicketMetadata.cs
using AiTicketHub.Domain.Enums;

namespace AiTicketHub.Application.DTOs;

public record TicketMetadata(
    TicketSource Source,
    string?      Browser,
    DeviceType   DeviceType
);
