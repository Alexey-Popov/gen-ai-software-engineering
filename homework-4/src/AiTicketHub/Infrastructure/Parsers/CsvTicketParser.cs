// src/AiTicketHub/Infrastructure/Parsers/CsvTicketParser.cs
using System.Text;
using AiTicketHub.Application.Interfaces;
using AiTicketHub.Application.Import;
using AiTicketHub.Domain.Enums;

namespace AiTicketHub.Infrastructure.Parsers;

public class CsvTicketParser : ICsvTicketParser
{
    public async Task<ParseResult<TicketImportRecord>> ParseAsync(Stream input, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(input);
        var records = new List<TicketImportRecord>();
        var errors  = new List<ParseRowError>();

        using var reader = new StreamReader(input, Encoding.UTF8, leaveOpen: true);

        var headerLine = await reader.ReadLineAsync(ct);
        if (string.IsNullOrWhiteSpace(headerLine))
            return new ParseResult<TicketImportRecord>(records, errors);

        var headers = SplitCsvLine(headerLine)
            .Select((h, i) => (Name: h.Trim().ToLowerInvariant(), Index: i))
            .Where(x => !string.IsNullOrEmpty(x.Name))
            .GroupBy(x => x.Name)
            .ToDictionary(g => g.Key, g => g.First().Index);

        int rowNumber = 1;
        string? line;
        while ((line = await reader.ReadLineAsync(ct)) != null)
        {
            rowNumber++;
            if (string.IsNullOrWhiteSpace(line)) continue;

            string[] fields;
            try { fields = SplitCsvLine(line); }
            catch (FormatException ex)
            {
                errors.Add(new ParseRowError(rowNumber, ex.Message));
                continue;
            }
            if (fields.Length < headers.Count)
            {
                errors.Add(new ParseRowError(rowNumber,
                    $"Row has {fields.Length} column(s) but header declares {headers.Count}."));
                continue;
            }
            var (record, error) = MapRow(headers, fields, rowNumber);

            if (error != null) errors.Add(error);
            else               records.Add(record!);
        }

        return new ParseResult<TicketImportRecord>(records, errors);
    }

    private static (TicketImportRecord? Record, ParseRowError? Error) MapRow(
        Dictionary<string, int> headers, string[] fields, int rowNumber)
    {
        string Get(string name)
        {
            string key = name.ToLowerInvariant();
            return headers.TryGetValue(key, out int idx) && idx < fields.Length
                ? fields[idx].Trim()
                : string.Empty;
        }

        // Required fields
        var customerId = Get("customerid");
        if (string.IsNullOrWhiteSpace(customerId))
            return (null, new ParseRowError(rowNumber, "Required field 'CustomerId' is missing or empty."));

        var customerEmail = Get("customeremail");
        if (string.IsNullOrWhiteSpace(customerEmail))
            return (null, new ParseRowError(rowNumber, "Required field 'CustomerEmail' is missing or empty."));

        var customerName = Get("customername");
        if (string.IsNullOrWhiteSpace(customerName))
            return (null, new ParseRowError(rowNumber, "Required field 'CustomerName' is missing or empty."));

        var subject = Get("subject");
        if (string.IsNullOrWhiteSpace(subject))
            return (null, new ParseRowError(rowNumber, "Required field 'Subject' is missing or empty."));

        var description = Get("description");
        if (string.IsNullOrWhiteSpace(description))
            return (null, new ParseRowError(rowNumber, "Required field 'Description' is missing or empty."));

        var categoryStr = Get("category");
        if (string.IsNullOrWhiteSpace(categoryStr))
            return (null, new ParseRowError(rowNumber, "Required field 'Category' is missing or empty."));
        if (!Enum.TryParse<TicketCategory>(categoryStr, ignoreCase: true, out var category))
            return (null, new ParseRowError(rowNumber, $"Invalid value '{categoryStr}' for field 'Category'."));

        var priorityStr = Get("priority");
        if (string.IsNullOrWhiteSpace(priorityStr))
            return (null, new ParseRowError(rowNumber, "Required field 'Priority' is missing or empty."));
        if (!Enum.TryParse<TicketPriority>(priorityStr, ignoreCase: true, out var priority))
            return (null, new ParseRowError(rowNumber, $"Invalid value '{priorityStr}' for field 'Priority'."));

        // Optional enum fields
        TicketStatus? status = null;
        var statusStr = Get("status");
        if (!string.IsNullOrWhiteSpace(statusStr))
        {
            if (!Enum.TryParse<TicketStatus>(statusStr, ignoreCase: true, out var s))
                return (null, new ParseRowError(rowNumber, $"Invalid value '{statusStr}' for field 'Status'."));
            status = s;
        }

        TicketSource? source = null;
        var sourceStr = Get("source");
        if (!string.IsNullOrWhiteSpace(sourceStr))
        {
            if (!Enum.TryParse<TicketSource>(sourceStr, ignoreCase: true, out var src))
                return (null, new ParseRowError(rowNumber, $"Invalid value '{sourceStr}' for field 'Source'."));
            source = src;
        }

        DeviceType? deviceType = null;
        var deviceTypeStr = Get("devicetype");
        if (!string.IsNullOrWhiteSpace(deviceTypeStr))
        {
            if (!Enum.TryParse<DeviceType>(deviceTypeStr, ignoreCase: true, out var dt))
                return (null, new ParseRowError(rowNumber, $"Invalid value '{deviceTypeStr}' for field 'DeviceType'."));
            deviceType = dt;
        }

        // Optional string fields
        var assignedTo = Get("assignedto");
        var browser    = Get("browser");

        // Tags: pipe-separated within the field
        var tagsStr = Get("tags");
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

    private static string[] SplitCsvLine(string line)
    {
        var fields   = new List<string>();
        var current  = new StringBuilder();
        bool inQuotes = false;

        for (int i = 0; i < line.Length; i++)
        {
            char c = line[i];
            if (c == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    current.Append('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (c == ',' && !inQuotes)
            {
                fields.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }

        if (inQuotes)
            throw new FormatException("Unterminated quoted field in CSV line.");
        fields.Add(current.ToString());
        return fields.ToArray();
    }
}
