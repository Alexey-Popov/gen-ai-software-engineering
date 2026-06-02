// src/AiTicketHub/Domain/Entities/Ticket.cs
using AiTicketHub.Domain.Common;
using AiTicketHub.Domain.Enums;

namespace AiTicketHub.Domain.Entities;

public class Ticket
{
    public Guid Id { get; private set; }
    public string CustomerId { get; private set; } = default!;
    public string CustomerEmail { get; private set; } = default!;
    public string CustomerName { get; private set; } = default!;
    public string Subject { get; private set; } = default!;
    public string Description { get; private set; } = default!;
    public TicketCategory Category { get; private set; }
    public TicketPriority Priority { get; private set; }
    public TicketStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public DateTime? ResolvedAt { get; private set; }
    public string? AssignedTo { get; private set; }
    public List<string> Tags { get; private set; } = default!;
    public TicketSource Source { get; private set; }
    public string? Browser { get; private set; }
    public DeviceType DeviceType { get; private set; }

    public Ticket(
        Guid id,
        string customerId,
        string customerEmail,
        string customerName,
        string subject,
        string description,
        TicketCategory category,
        TicketPriority priority,
        TicketStatus status,
        DateTime createdAt,
        DateTime updatedAt,
        DateTime? resolvedAt,
        string? assignedTo,
        List<string> tags,
        TicketSource source,
        string? browser,
        DeviceType deviceType)
    {
        if (string.IsNullOrWhiteSpace(customerId))    throw new ArgumentException("CustomerId is required.",    nameof(customerId));
        if (string.IsNullOrWhiteSpace(customerEmail)) throw new ArgumentException("CustomerEmail is required.", nameof(customerEmail));
        if (string.IsNullOrWhiteSpace(customerName))  throw new ArgumentException("CustomerName is required.",  nameof(customerName));
        if (string.IsNullOrWhiteSpace(subject))       throw new ArgumentException("Subject is required.",       nameof(subject));
        if (string.IsNullOrWhiteSpace(description))   throw new ArgumentException("Description is required.",   nameof(description));
        Id = id;
        CustomerId = customerId;
        CustomerEmail = customerEmail;
        CustomerName = customerName;
        Subject = subject;
        Description = description;
        Category = category;
        Priority = priority;
        Status = status;
        CreatedAt = createdAt;
        UpdatedAt = updatedAt;
        ResolvedAt = resolvedAt;
        AssignedTo = assignedTo;
        Tags = tags;
        Source = source;
        Browser = browser;
        DeviceType = deviceType;
    }

    // Validates and performs the status transition. Only forward transitions are allowed.
    public Result TransitionTo(TicketStatus newStatus)
    {
        var isValid = (Status, newStatus) switch
        {
            (TicketStatus.New,             TicketStatus.InProgress)      => true,
            (TicketStatus.InProgress,      TicketStatus.WaitingCustomer) => true,
            (TicketStatus.InProgress,      TicketStatus.Resolved)        => true,
            (TicketStatus.WaitingCustomer, TicketStatus.Resolved)        => true,
            (TicketStatus.Resolved,        TicketStatus.Closed)          => true,
            _ => false
        };

        if (!isValid)
            return Result.Failure(Errors.TicketInvalidStatus);

        Status = newStatus;
        UpdatedAt = DateTime.UtcNow;

        if (newStatus == TicketStatus.Resolved)
            ResolvedAt = DateTime.UtcNow;

        return Result.Success();
    }

    // Returns failure when the ticket is in a terminal status and cannot be deleted.
    public Result CanBeDeleted()
    {
        if (Status == TicketStatus.Resolved || Status == TicketStatus.Closed)
            return Result.Failure(Errors.TicketInvalidStatus);

        return Result.Success();
    }

    // Applies classifier-determined category and priority.
    public void ApplyClassification(TicketCategory category, TicketPriority priority)
    {
        Category  = category;
        Priority  = priority;
        UpdatedAt = DateTime.UtcNow;
    }

    // Applies partial field updates; null values leave the existing field unchanged.
    public void ApplyUpdate(
        string? subject,
        string? description,
        TicketCategory? category,
        TicketPriority? priority,
        string? assignedTo,
        List<string>? tags,
        string? browser,
        DeviceType? deviceType)
    {
        if (!string.IsNullOrEmpty(subject))     Subject     = subject;
        if (!string.IsNullOrEmpty(description)) Description = description;
        if (category.HasValue)      Category    = category.Value;
        if (priority.HasValue)      Priority    = priority.Value;
        if (assignedTo  != null)    AssignedTo  = assignedTo;
        if (tags        != null)    Tags        = tags;
        if (browser     != null)    Browser     = browser;
        if (deviceType.HasValue)    DeviceType  = deviceType.Value;
        UpdatedAt = DateTime.UtcNow;
    }
}
