// src/AiTicketHub/Infrastructure/Parsers/XmlTicketParser.cs
using System.Xml.Linq;
using AiTicketHub.Application.Interfaces;
using AiTicketHub.Application.Import;
using AiTicketHub.Domain.Enums;

namespace AiTicketHub.Infrastructure.Parsers;

public class XmlTicketParser : IXmlTicketParser
{
    public async Task<ParseResult<TicketImportRecord>> ParseAsync(Stream input, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(input);
        var records = new List<TicketImportRecord>();
        var errors  = new List<ParseRowError>();

        // Buffer stream to check emptiness
        using var buffer = new MemoryStream();
        await input.CopyToAsync(buffer, ct);
        if (buffer.Length == 0)
            return new ParseResult<TicketImportRecord>(records, errors);
        buffer.Position = 0;

        XDocument doc;
        try
        {
            doc = await XDocument.LoadAsync(buffer, LoadOptions.None, ct);
        }
        catch (Exception ex)
        {
            errors.Add(new ParseRowError(0, $"Invalid XML document: {ex.Message}"));
            return new ParseResult<TicketImportRecord>(records, errors);
        }

        if (doc.Root == null)
        {
            errors.Add(new ParseRowError(0, "XML document has no root element."));
            return new ParseResult<TicketImportRecord>(records, errors);
        }

        int rowNumber = 0;
        foreach (var ticketElement in doc.Root.Elements()
                     .Where(e => e.Name.LocalName.Equals("Ticket", StringComparison.OrdinalIgnoreCase)))
        {
            rowNumber++;
            var (record, error) = MapElement(ticketElement, rowNumber);
            if (error != null) errors.Add(error);
            else               records.Add(record!);
        }

        return new ParseResult<TicketImportRecord>(records, errors);
    }

    private static (TicketImportRecord? Record, ParseRowError? Error) MapElement(XElement element, int rowNumber)
    {
        // Required string fields
        var customerId = GetValue(element, "CustomerId");
        if (string.IsNullOrWhiteSpace(customerId))
            return (null, new ParseRowError(rowNumber, "Required field 'CustomerId' is missing or empty."));

        var customerEmail = GetValue(element, "CustomerEmail");
        if (string.IsNullOrWhiteSpace(customerEmail))
            return (null, new ParseRowError(rowNumber, "Required field 'CustomerEmail' is missing or empty."));

        var customerName = GetValue(element, "CustomerName");
        if (string.IsNullOrWhiteSpace(customerName))
            return (null, new ParseRowError(rowNumber, "Required field 'CustomerName' is missing or empty."));

        var subject = GetValue(element, "Subject");
        if (string.IsNullOrWhiteSpace(subject))
            return (null, new ParseRowError(rowNumber, "Required field 'Subject' is missing or empty."));

        var description = GetValue(element, "Description");
        if (string.IsNullOrWhiteSpace(description))
            return (null, new ParseRowError(rowNumber, "Required field 'Description' is missing or empty."));

        // Required enum fields
        var categoryStr = GetValue(element, "Category");
        if (string.IsNullOrWhiteSpace(categoryStr))
            return (null, new ParseRowError(rowNumber, "Required field 'Category' is missing or empty."));
        if (!Enum.TryParse<TicketCategory>(categoryStr, ignoreCase: true, out var category))
            return (null, new ParseRowError(rowNumber, $"Invalid value '{categoryStr}' for field 'Category'."));

        var priorityStr = GetValue(element, "Priority");
        if (string.IsNullOrWhiteSpace(priorityStr))
            return (null, new ParseRowError(rowNumber, "Required field 'Priority' is missing or empty."));
        if (!Enum.TryParse<TicketPriority>(priorityStr, ignoreCase: true, out var priority))
            return (null, new ParseRowError(rowNumber, $"Invalid value '{priorityStr}' for field 'Priority'."));

        // Optional enum fields
        TicketStatus? status = null;
        var statusStr = GetValue(element, "Status");
        if (!string.IsNullOrWhiteSpace(statusStr))
        {
            if (!Enum.TryParse<TicketStatus>(statusStr, ignoreCase: true, out var s))
                return (null, new ParseRowError(rowNumber, $"Invalid value '{statusStr}' for field 'Status'."));
            status = s;
        }

        TicketSource? source = null;
        var sourceStr = GetValue(element, "Source");
        if (!string.IsNullOrWhiteSpace(sourceStr))
        {
            if (!Enum.TryParse<TicketSource>(sourceStr, ignoreCase: true, out var src))
                return (null, new ParseRowError(rowNumber, $"Invalid value '{sourceStr}' for field 'Source'."));
            source = src;
        }

        DeviceType? deviceType = null;
        var deviceTypeStr = GetValue(element, "DeviceType");
        if (!string.IsNullOrWhiteSpace(deviceTypeStr))
        {
            if (!Enum.TryParse<DeviceType>(deviceTypeStr, ignoreCase: true, out var dt))
                return (null, new ParseRowError(rowNumber, $"Invalid value '{deviceTypeStr}' for field 'DeviceType'."));
            deviceType = dt;
        }

        // Optional string fields
        var assignedTo = GetValue(element, "AssignedTo");
        var browser    = GetValue(element, "Browser");

        // Tags: pipe-separated within a single <Tags> element
        var tagsStr = GetValue(element, "Tags");
        var tags = string.IsNullOrWhiteSpace(tagsStr)
            ? null
            : tagsStr.Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

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

    private static string? GetValue(XElement parent, string name)
    {
        var child = parent.Elements()
            .FirstOrDefault(e => e.Name.LocalName.Equals(name, StringComparison.OrdinalIgnoreCase));
        if (child == null) return null;
        return child.Value.Trim();
    }
}
