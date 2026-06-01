// src/AiTicketHub/Infrastructure/Parsers/JsonTicketParser.cs
using System.Text.Json;
using AiTicketHub.Application.Interfaces;
using AiTicketHub.Application.Import;
using AiTicketHub.Domain.Enums;

namespace AiTicketHub.Infrastructure.Parsers;

public class JsonTicketParser : IJsonTicketParser
{
    public async Task<ParseResult<TicketImportRecord>> ParseAsync(Stream input, CancellationToken ct = default)
    {
        var records = new List<TicketImportRecord>();
        var errors  = new List<ParseRowError>();

        // Buffer the stream so we can check for empty content
        using var buffer = new MemoryStream();
        await input.CopyToAsync(buffer, ct);
        if (buffer.Length == 0)
            return new ParseResult<TicketImportRecord>(records, errors);
        buffer.Position = 0;

        JsonDocument doc;
        try
        {
            doc = await JsonDocument.ParseAsync(buffer, cancellationToken: ct);
        }
        catch (JsonException ex)
        {
            errors.Add(new ParseRowError(0, $"Invalid JSON document: {ex.Message}"));
            return new ParseResult<TicketImportRecord>(records, errors);
        }

        if (doc.RootElement.ValueKind != JsonValueKind.Array)
        {
            errors.Add(new ParseRowError(0, "JSON root element must be an array."));
            return new ParseResult<TicketImportRecord>(records, errors);
        }

        int rowNumber = 0;
        foreach (var element in doc.RootElement.EnumerateArray())
        {
            rowNumber++;
            if (element.ValueKind != JsonValueKind.Object)
            {
                errors.Add(new ParseRowError(rowNumber, $"Expected a JSON object at index {rowNumber - 1} but got {element.ValueKind}."));
                continue;
            }

            var (record, error) = MapElement(element, rowNumber);
            if (error != null) errors.Add(error);
            else               records.Add(record!);
        }

        return new ParseResult<TicketImportRecord>(records, errors);
    }

    private static (TicketImportRecord? Record, ParseRowError? Error) MapElement(JsonElement element, int rowNumber)
    {
        // Required string fields
        var customerId = GetString(element, "customerId");
        if (string.IsNullOrWhiteSpace(customerId))
            return (null, new ParseRowError(rowNumber, "Required field 'customerId' is missing or empty."));

        var customerEmail = GetString(element, "customerEmail");
        if (string.IsNullOrWhiteSpace(customerEmail))
            return (null, new ParseRowError(rowNumber, "Required field 'customerEmail' is missing or empty."));

        var customerName = GetString(element, "customerName");
        if (string.IsNullOrWhiteSpace(customerName))
            return (null, new ParseRowError(rowNumber, "Required field 'customerName' is missing or empty."));

        var subject = GetString(element, "subject");
        if (string.IsNullOrWhiteSpace(subject))
            return (null, new ParseRowError(rowNumber, "Required field 'subject' is missing or empty."));

        var description = GetString(element, "description");
        if (string.IsNullOrWhiteSpace(description))
            return (null, new ParseRowError(rowNumber, "Required field 'description' is missing or empty."));

        // Required enum fields
        var categoryStr = GetString(element, "category");
        if (string.IsNullOrWhiteSpace(categoryStr))
            return (null, new ParseRowError(rowNumber, "Required field 'category' is missing or empty."));
        if (!Enum.TryParse<TicketCategory>(categoryStr, ignoreCase: true, out var category))
            return (null, new ParseRowError(rowNumber, $"Invalid value '{categoryStr}' for field 'category'."));

        var priorityStr = GetString(element, "priority");
        if (string.IsNullOrWhiteSpace(priorityStr))
            return (null, new ParseRowError(rowNumber, "Required field 'priority' is missing or empty."));
        if (!Enum.TryParse<TicketPriority>(priorityStr, ignoreCase: true, out var priority))
            return (null, new ParseRowError(rowNumber, $"Invalid value '{priorityStr}' for field 'priority'."));

        // Optional enum fields
        TicketStatus? status = null;
        var statusStr = GetString(element, "status");
        if (!string.IsNullOrWhiteSpace(statusStr))
        {
            if (!Enum.TryParse<TicketStatus>(statusStr, ignoreCase: true, out var s))
                return (null, new ParseRowError(rowNumber, $"Invalid value '{statusStr}' for field 'status'."));
            status = s;
        }

        TicketSource? source = null;
        var sourceStr = GetString(element, "source");
        if (!string.IsNullOrWhiteSpace(sourceStr))
        {
            if (!Enum.TryParse<TicketSource>(sourceStr, ignoreCase: true, out var src))
                return (null, new ParseRowError(rowNumber, $"Invalid value '{sourceStr}' for field 'source'."));
            source = src;
        }

        DeviceType? deviceType = null;
        var deviceTypeStr = GetString(element, "deviceType");
        if (!string.IsNullOrWhiteSpace(deviceTypeStr))
        {
            if (!Enum.TryParse<DeviceType>(deviceTypeStr, ignoreCase: true, out var dt))
                return (null, new ParseRowError(rowNumber, $"Invalid value '{deviceTypeStr}' for field 'deviceType'."));
            deviceType = dt;
        }

        var assignedTo = GetString(element, "assignedTo");
        var browser    = GetString(element, "browser");
        var tags       = GetStringArray(element, "tags");

        return (new TicketImportRecord(
            customerId,
            customerEmail,
            customerName,
            subject,
            description,
            category,
            priority,
            status,
            string.IsNullOrWhiteSpace(assignedTo) ? null : assignedTo,
            tags,
            source,
            string.IsNullOrWhiteSpace(browser) ? null : browser,
            deviceType), null);
    }

    private static string? GetString(JsonElement element, string name)
    {
        foreach (var prop in element.EnumerateObject())
        {
            if (!prop.Name.Equals(name, StringComparison.OrdinalIgnoreCase)) continue;
            return prop.Value.ValueKind == JsonValueKind.String
                ? prop.Value.GetString()?.Trim()
                : null;
        }
        return null;
    }

    private static List<string>? GetStringArray(JsonElement element, string name)
    {
        foreach (var prop in element.EnumerateObject())
        {
            if (!prop.Name.Equals(name, StringComparison.OrdinalIgnoreCase)) continue;
            if (prop.Value.ValueKind != JsonValueKind.Array) return null;
            return prop.Value.EnumerateArray()
                .Where(e => e.ValueKind == JsonValueKind.String)
                .Select(e => e.GetString()!.Trim())
                .Where(s => !string.IsNullOrEmpty(s))
                .ToList();
        }
        return null;
    }
}
