using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Xml.Linq;
using System.Text.Json.Serialization;
using TicketManagementApi.Models;
using TicketManagementApi.Repositories;

namespace TicketManagementApi.Services;

public class ImportService : IImportService
{
    private readonly ITicketRepository _repository;
    private readonly IAutoClassificationService _classifier;

    public ImportService(ITicketRepository repository, IAutoClassificationService classifier)
    {
        _repository = repository;
        _classifier = classifier;
    }

    public async Task<ImportSummary> ImportTicketsAsync(Stream fileStream, string format, bool autoClassify)
    {
        var summary = new ImportSummary();
        var ticketsToImport = new List<(CreateTicketDto Dto, int RowNumber)>();

        using var reader = new StreamReader(fileStream, Encoding.UTF8);
        var content = await reader.ReadToEndAsync();

        if (string.IsNullOrWhiteSpace(content))
        {
            summary.Errors.Add(new ImportError { Row = 0, Error = "File is empty." });
            summary.Failed = 1;
            return summary;
        }

        format = format.ToLowerInvariant();
        try
        {
            if (format == "json")
            {
                ParseJson(content, ticketsToImport, summary);
            }
            else if (format == "xml")
            {
                ParseXml(content, ticketsToImport, summary);
            }
            else if (format == "csv")
            {
                ParseCsv(content, ticketsToImport, summary);
            }
            else
            {
                summary.Errors.Add(new ImportError { Row = 0, Error = $"Unsupported format: {format}" });
                summary.Failed = 1;
                return summary;
            }
        }
        catch (Exception ex)
        {
            summary.Errors.Add(new ImportError { Row = 0, Error = $"Malformed file structure: {ex.Message}" });
            summary.Failed = 1;
            return summary;
        }

        summary.TotalRecords = ticketsToImport.Count + summary.Errors.Count;
        summary.Failed = summary.Errors.Count;

        // Process and save valid tickets
        foreach (var item in ticketsToImport)
        {
            var dto = item.Dto;
            var rowNum = item.RowNumber;

            // Perform DataAnnotations validations
            var validationContext = new ValidationContext(dto);
            var validationResults = new List<ValidationResult>();
            bool isValid = Validator.TryValidateObject(dto, validationContext, validationResults, true);

            // Also validate nested metadata
            if (dto.Metadata != null)
            {
                var metaContext = new ValidationContext(dto.Metadata);
                var metaResults = new List<ValidationResult>();
                if (!Validator.TryValidateObject(dto.Metadata, metaContext, metaResults, true))
                {
                    isValid = false;
                    validationResults.AddRange(metaResults);
                }
            }
            else
            {
                isValid = false;
                validationResults.Add(new ValidationResult("metadata is required"));
            }

            if (!isValid)
            {
                var errorMsg = string.Join("; ", validationResults.Select(r => r.ErrorMessage));
                summary.Errors.Add(new ImportError { Row = rowNum, Error = errorMsg });
                summary.Failed++;
                continue;
            }

            try
            {
                // Map Dto to Ticket
                var ticket = new Ticket
                {
                    CustomerId = dto.CustomerId,
                    CustomerEmail = dto.CustomerEmail,
                    CustomerName = dto.CustomerName,
                    Subject = dto.Subject,
                    Description = dto.Description,
                    Status = dto.Status,
                    AssignedTo = dto.AssignedTo,
                    Tags = dto.Tags ?? new List<string>(),
                    Metadata = new TicketMetadata
                    {
                        Source = dto.Metadata!.Source,
                        Browser = dto.Metadata.Browser,
                        DeviceType = dto.Metadata.DeviceType
                    }
                };

                // Apply classification if requested or if missing properties
                if (autoClassify || !dto.Category.HasValue || !dto.Priority.HasValue)
                {
                    var classification = _classifier.Classify(ticket.Subject, ticket.Description);
                    
                    ticket.Category = dto.Category ?? classification.Category;
                    ticket.Priority = dto.Priority ?? classification.Priority;
                    ticket.ClassificationConfidence = classification.Confidence;
                    ticket.ClassificationReasoning = classification.Reasoning;
                    ticket.ClassificationKeywords = classification.KeywordsFound;
                }
                else
                {
                    ticket.Category = dto.Category.Value;
                    ticket.Priority = dto.Priority.Value;
                    ticket.ClassificationConfidence = 1.0; // Manual set
                    ticket.ClassificationReasoning = "Manually specified during import.";
                }

                await _repository.CreateAsync(ticket);
                summary.Successful++;
            }
            catch (Exception ex)
            {
                summary.Errors.Add(new ImportError { Row = rowNum, Error = $"Database error: {ex.Message}" });
                summary.Failed++;
            }
        }

        return summary;
    }

    private void ParseJson(string content, List<(CreateTicketDto Dto, int RowNumber)> tickets, ImportSummary summary)
    {
        try
        {
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                Converters = { new JsonStringEnumConverter() }
            };

            var list = JsonSerializer.Deserialize<List<CreateTicketDto>>(content, options);
            if (list == null)
            {
                summary.Errors.Add(new ImportError { Row = 0, Error = "Failed to deserialize JSON content." });
                return;
            }

            for (int i = 0; i < list.Count; i++)
            {
                tickets.Add((list[i], i + 1));
            }
        }
        catch (JsonException ex)
        {
            summary.Errors.Add(new ImportError { Row = 0, Error = $"JSON parsing error: {ex.Message}" });
        }
    }

    private void ParseXml(string content, List<(CreateTicketDto Dto, int RowNumber)> tickets, ImportSummary summary)
    {
        var doc = XDocument.Parse(content);
        var ticketElements = doc.Root?.Elements("ticket") ?? Enumerable.Empty<XElement>();

        int index = 0;
        foreach (var el in ticketElements)
        {
            index++;
            var rowErrors = new List<string>();

            var customerId = el.Element("customer_id")?.Value ?? string.Empty;
            var customerEmail = el.Element("customer_email")?.Value ?? string.Empty;
            var customerName = el.Element("customer_name")?.Value ?? string.Empty;
            var subject = el.Element("subject")?.Value ?? string.Empty;
            var description = el.Element("description")?.Value ?? string.Empty;
            var assignedTo = el.Element("assigned_to")?.Value;

            // Enums
            var categoryVal = el.Element("category")?.Value;
            TicketCategory? category = null;
            if (!string.IsNullOrEmpty(categoryVal))
            {
                if (Enum.TryParse<TicketCategory>(categoryVal, true, out var cat))
                    category = cat;
                else
                    rowErrors.Add($"Invalid category '{categoryVal}'");
            }

            var priorityVal = el.Element("priority")?.Value;
            TicketPriority? priority = null;
            if (!string.IsNullOrEmpty(priorityVal))
            {
                if (Enum.TryParse<TicketPriority>(priorityVal, true, out var prio))
                    priority = prio;
                else
                    rowErrors.Add($"Invalid priority '{priorityVal}'");
            }

            var statusVal = el.Element("status")?.Value ?? "new";
            var status = TicketStatus.@new;
            if (Enum.TryParse<TicketStatus>(statusVal, true, out var stat))
            {
                status = stat;
            }
            else
            {
                rowErrors.Add($"Invalid status '{statusVal}'");
            }

            // Tags
            var tags = new List<string>();
            var tagsEl = el.Element("tags");
            if (tagsEl != null)
            {
                var childTags = tagsEl.Elements("tag").ToList();
                if (childTags.Count > 0)
                {
                    tags.AddRange(childTags.Select(t => t.Value));
                }
                else if (!string.IsNullOrEmpty(tagsEl.Value))
                {
                    tags.AddRange(tagsEl.Value.Split(',', ';').Select(t => t.Trim()).Where(t => !string.IsNullOrEmpty(t)));
                }
            }

            // Metadata
            var metaEl = el.Element("metadata");
            var sourceVal = metaEl?.Element("source")?.Value ?? string.Empty;
            var browser = metaEl?.Element("browser")?.Value;
            var deviceTypeVal = metaEl?.Element("device_type")?.Value ?? string.Empty;

            var source = TicketSource.web_form;
            if (!Enum.TryParse<TicketSource>(sourceVal, true, out var src))
            {
                rowErrors.Add($"Invalid source '{sourceVal}'");
            }
            else
            {
                source = src;
            }

            var deviceType = DeviceType.desktop;
            if (!Enum.TryParse<DeviceType>(deviceTypeVal, true, out var dev))
            {
                rowErrors.Add($"Invalid device_type '{deviceTypeVal}'");
            }
            else
            {
                deviceType = dev;
            }

            if (rowErrors.Count > 0)
            {
                summary.Errors.Add(new ImportError { Row = index, Error = string.Join("; ", rowErrors) });
                summary.Failed++;
                continue;
            }

            var dto = new CreateTicketDto
            {
                CustomerId = customerId,
                CustomerEmail = customerEmail,
                CustomerName = customerName,
                Subject = subject,
                Description = description,
                Category = category,
                Priority = priority,
                Status = status,
                AssignedTo = assignedTo,
                Tags = tags,
                Metadata = new CreateTicketMetadataDto
                {
                    Source = source,
                    Browser = browser,
                    DeviceType = deviceType
                }
            };

            tickets.Add((dto, index));
        }
    }

    private void ParseCsv(string content, List<(CreateTicketDto Dto, int RowNumber)> tickets, ImportSummary summary)
    {
        var records = SplitCsv(content);
        if (records.Count == 0)
        {
            summary.Errors.Add(new ImportError { Row = 0, Error = "CSV file is empty." });
            return;
        }

        var header = records[0];
        var headerMap = header
            .Select((name, idx) => new { name = name.Trim().ToLowerInvariant(), idx })
            .ToDictionary(x => x.name, x => x.idx);

        // Required headers validation
        var requiredHeaders = new[] { "customer_id", "customer_email", "customer_name", "subject", "description", "source", "device_type" };
        var missingHeaders = requiredHeaders.Where(h => !headerMap.ContainsKey(h)).ToList();
        if (missingHeaders.Count > 0)
        {
            summary.Errors.Add(new ImportError { Row = 1, Error = $"Missing required headers: {string.Join(", ", missingHeaders)}" });
            return;
        }

        for (int i = 1; i < records.Count; i++)
        {
            var row = records[i];
            // Skip empty rows
            if (row.Count == 0 || (row.Count == 1 && string.IsNullOrWhiteSpace(row[0])))
            {
                continue;
            }

            int rowNum = i + 1; // 1-based index (header is row 1, first data row is 2)
            var rowErrors = new List<string>();

            string GetVal(string name)
            {
                if (headerMap.TryGetValue(name, out int idx) && idx < row.Count)
                {
                    return row[idx]?.Trim() ?? string.Empty;
                }
                return string.Empty;
            }

            var customerId = GetVal("customer_id");
            var customerEmail = GetVal("customer_email");
            var customerName = GetVal("customer_name");
            var subject = GetVal("subject");
            var description = GetVal("description");
            var assignedTo = GetVal("assigned_to");

            // Optionals/Nullables
            if (string.IsNullOrEmpty(assignedTo))
            {
                assignedTo = null;
            }

            // Enums parsing
            var categoryVal = GetVal("category");
            TicketCategory? category = null;
            if (!string.IsNullOrEmpty(categoryVal))
            {
                if (Enum.TryParse<TicketCategory>(categoryVal, true, out var cat))
                    category = cat;
                else
                    rowErrors.Add($"Invalid category '{categoryVal}'");
            }

            var priorityVal = GetVal("priority");
            TicketPriority? priority = null;
            if (!string.IsNullOrEmpty(priorityVal))
            {
                if (Enum.TryParse<TicketPriority>(priorityVal, true, out var prio))
                    priority = prio;
                else
                    rowErrors.Add($"Invalid priority '{priorityVal}'");
            }

            var statusVal = GetVal("status");
            var status = TicketStatus.@new;
            if (!string.IsNullOrEmpty(statusVal))
            {
                if (Enum.TryParse<TicketStatus>(statusVal, true, out var stat))
                    status = stat;
                else
                    rowErrors.Add($"Invalid status '{statusVal}'");
            }

            // Tags (can be separated by semicolon or comma inside the field)
            var tagsVal = GetVal("tags");
            var tags = new List<string>();
            if (!string.IsNullOrEmpty(tagsVal))
            {
                tags.AddRange(tagsVal.Split(';', '|').Select(t => t.Trim()).Where(t => !string.IsNullOrEmpty(t)));
            }

            // Metadata
            var sourceVal = GetVal("source");
            var browserVal = GetVal("browser");
            var deviceTypeVal = GetVal("device_type");

            var source = TicketSource.web_form;
            if (!Enum.TryParse<TicketSource>(sourceVal, true, out var src))
            {
                rowErrors.Add($"Invalid source '{sourceVal}'");
            }
            else
            {
                source = src;
            }

            var deviceType = DeviceType.desktop;
            if (!Enum.TryParse<DeviceType>(deviceTypeVal, true, out var dev))
            {
                rowErrors.Add($"Invalid device_type '{deviceTypeVal}'");
            }
            else
            {
                deviceType = dev;
            }

            if (rowErrors.Count > 0)
            {
                summary.Errors.Add(new ImportError { Row = rowNum, Error = string.Join("; ", rowErrors) });
                summary.Failed++;
                continue;
            }

            var dto = new CreateTicketDto
            {
                CustomerId = customerId,
                CustomerEmail = customerEmail,
                CustomerName = customerName,
                Subject = subject,
                Description = description,
                Category = category,
                Priority = priority,
                Status = status,
                AssignedTo = assignedTo,
                Tags = tags,
                Metadata = new CreateTicketMetadataDto
                {
                    Source = source,
                    Browser = string.IsNullOrEmpty(browserVal) ? null : browserVal,
                    DeviceType = deviceType
                }
            };

            tickets.Add((dto, rowNum));
        }
    }

    private static List<List<string>> SplitCsv(string text)
    {
        var records = new List<List<string>>();
        var currentField = new StringBuilder();
        var currentRecord = new List<string>();
        bool inQuotes = false;

        for (int i = 0; i < text.Length; i++)
        {
            char c = text[i];
            if (inQuotes)
            {
                if (c == '"')
                {
                    if (i + 1 < text.Length && text[i + 1] == '"')
                    {
                        currentField.Append('"');
                        i++; // skip next quote
                    }
                    else
                    {
                        inQuotes = false;
                    }
                }
                else
                {
                    currentField.Append(c);
                }
            }
            else
            {
                if (c == '"')
                {
                    inQuotes = true;
                }
                else if (c == ',')
                {
                    currentRecord.Add(currentField.ToString());
                    currentField.Clear();
                }
                else if (c == '\r')
                {
                    if (i + 1 < text.Length && text[i + 1] == '\n')
                    {
                        i++;
                    }
                    currentRecord.Add(currentField.ToString());
                    currentField.Clear();
                    records.Add(currentRecord);
                    currentRecord = new List<string>();
                }
                else if (c == '\n')
                {
                    currentRecord.Add(currentField.ToString());
                    currentField.Clear();
                    records.Add(currentRecord);
                    currentRecord = new List<string>();
                }
                else
                {
                    currentField.Append(c);
                }
            }
        }

        if (currentRecord.Count > 0 || currentField.Length > 0)
        {
            currentRecord.Add(currentField.ToString());
            records.Add(currentRecord);
        }

        return records;
    }
}
