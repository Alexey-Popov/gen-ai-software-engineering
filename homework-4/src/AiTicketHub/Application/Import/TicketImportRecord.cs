// src/AiTicketHub/Application/Import/TicketImportRecord.cs
using AiTicketHub.Domain.Enums;

namespace AiTicketHub.Application.Import;

public record TicketImportRecord(
    string CustomerId,
    string CustomerEmail,
    string CustomerName,
    string Subject,
    string Description,
    TicketCategory Category,
    TicketPriority Priority,
    TicketStatus?  Status,
    string?        AssignedTo,
    List<string>?  Tags,
    TicketSource?  Source,
    string?        Browser,
    DeviceType?    DeviceType
);
