using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace TicketManagementApi.Models;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TicketCategory
{
    account_access,
    technical_issue,
    billing_question,
    feature_request,
    bug_report,
    other
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TicketPriority
{
    urgent,
    high,
    medium,
    low
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TicketStatus
{
    @new,
    in_progress,
    waiting_customer,
    resolved,
    closed
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TicketSource
{
    web_form,
    email,
    api,
    chat,
    phone
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum DeviceType
{
    desktop,
    mobile,
    tablet
}

public class TicketMetadata
{
    [Required]
    [JsonPropertyName("source")]
    public TicketSource Source { get; set; }

    [JsonPropertyName("browser")]
    public string? Browser { get; set; }

    [Required]
    [JsonPropertyName("device_type")]
    public DeviceType DeviceType { get; set; }
}

public class Ticket
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("customer_id")]
    public string CustomerId { get; set; } = string.Empty;

    [JsonPropertyName("customer_email")]
    public string CustomerEmail { get; set; } = string.Empty;

    [JsonPropertyName("customer_name")]
    public string CustomerName { get; set; } = string.Empty;

    [JsonPropertyName("subject")]
    public string Subject { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("category")]
    public TicketCategory Category { get; set; }

    [JsonPropertyName("priority")]
    public TicketPriority Priority { get; set; }

    [JsonPropertyName("status")]
    public TicketStatus Status { get; set; }

    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }

    [JsonPropertyName("updated_at")]
    public DateTime UpdatedAt { get; set; }

    [JsonPropertyName("resolved_at")]
    public DateTime? ResolvedAt { get; set; }

    [JsonPropertyName("assigned_to")]
    public string? AssignedTo { get; set; }

    [JsonPropertyName("tags")]
    public List<string> Tags { get; set; } = new();

    [JsonPropertyName("metadata")]
    public TicketMetadata Metadata { get; set; } = new();

    [JsonPropertyName("classification_confidence")]
    public double? ClassificationConfidence { get; set; }

    [JsonPropertyName("classification_reasoning")]
    public string? ClassificationReasoning { get; set; }

    [JsonPropertyName("classification_keywords")]
    public List<string> ClassificationKeywords { get; set; } = new();
}

public class CreateTicketDto
{
    [Required(ErrorMessage = "customer_id is required")]
    [JsonPropertyName("customer_id")]
    public string CustomerId { get; set; } = string.Empty;

    [Required(ErrorMessage = "customer_email is required")]
    [EmailAddress(ErrorMessage = "customer_email must be a valid email address")]
    [JsonPropertyName("customer_email")]
    public string CustomerEmail { get; set; } = string.Empty;

    [Required(ErrorMessage = "customer_name is required")]
    [JsonPropertyName("customer_name")]
    public string CustomerName { get; set; } = string.Empty;

    [Required(ErrorMessage = "subject is required")]
    [StringLength(200, MinimumLength = 1, ErrorMessage = "subject must be between 1 and 200 characters")]
    [JsonPropertyName("subject")]
    public string Subject { get; set; } = string.Empty;

    [Required(ErrorMessage = "description is required")]
    [StringLength(2000, MinimumLength = 10, ErrorMessage = "description must be between 10 and 2000 characters")]
    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("category")]
    public TicketCategory? Category { get; set; }

    [JsonPropertyName("priority")]
    public TicketPriority? Priority { get; set; }

    [JsonPropertyName("status")]
    public TicketStatus Status { get; set; } = TicketStatus.@new;

    [JsonPropertyName("assigned_to")]
    public string? AssignedTo { get; set; }

    [JsonPropertyName("tags")]
    public List<string> Tags { get; set; } = new();

    [Required(ErrorMessage = "metadata is required")]
    [JsonPropertyName("metadata")]
    public CreateTicketMetadataDto Metadata { get; set; } = new();

    [JsonPropertyName("auto_classify")]
    public bool AutoClassify { get; set; } = true;
}

public class CreateTicketMetadataDto
{
    [Required(ErrorMessage = "source is required")]
    [JsonPropertyName("source")]
    public TicketSource Source { get; set; }

    [JsonPropertyName("browser")]
    public string? Browser { get; set; }

    [Required(ErrorMessage = "device_type is required")]
    [JsonPropertyName("device_type")]
    public DeviceType DeviceType { get; set; }
}

public class UpdateTicketDto
{
    [JsonPropertyName("customer_id")]
    public string? CustomerId { get; set; }

    [EmailAddress(ErrorMessage = "customer_email must be a valid email address")]
    [JsonPropertyName("customer_email")]
    public string? CustomerEmail { get; set; }

    [JsonPropertyName("customer_name")]
    public string? CustomerName { get; set; }

    [StringLength(200, MinimumLength = 1, ErrorMessage = "subject must be between 1 and 200 characters")]
    [JsonPropertyName("subject")]
    public string? Subject { get; set; }

    [StringLength(2000, MinimumLength = 10, ErrorMessage = "description must be between 10 and 2000 characters")]
    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("category")]
    public TicketCategory? Category { get; set; }

    [JsonPropertyName("priority")]
    public TicketPriority? Priority { get; set; }

    [JsonPropertyName("status")]
    public TicketStatus? Status { get; set; }

    [JsonPropertyName("assigned_to")]
    public string? AssignedTo { get; set; }

    [JsonPropertyName("tags")]
    public List<string>? Tags { get; set; }

    [JsonPropertyName("metadata")]
    public CreateTicketMetadataDto? Metadata { get; set; }
}

public class AutoClassifyResult
{
    [JsonPropertyName("category")]
    public TicketCategory Category { get; set; }

    [JsonPropertyName("priority")]
    public TicketPriority Priority { get; set; }

    [JsonPropertyName("confidence")]
    public double Confidence { get; set; }

    [JsonPropertyName("reasoning")]
    public string Reasoning { get; set; } = string.Empty;

    [JsonPropertyName("keywords_found")]
    public List<string> KeywordsFound { get; set; } = new();
}

public class ImportSummary
{
    [JsonPropertyName("total_records")]
    public int TotalRecords { get; set; }

    [JsonPropertyName("successful")]
    public int Successful { get; set; }

    [JsonPropertyName("failed")]
    public int Failed { get; set; }

    [JsonPropertyName("errors")]
    public List<ImportError> Errors { get; set; } = new();
}

public class ImportError
{
    [JsonPropertyName("row")]
    public int Row { get; set; }

    [JsonPropertyName("error")]
    public string Error { get; set; } = string.Empty;
}
