// src/AiTicketHub/Application/Services/TicketImportService.cs
using AiTicketHub.Application.DTOs;
using AiTicketHub.Application.Import;
using AiTicketHub.Application.Interfaces;
using AiTicketHub.Domain.Entities;
using AiTicketHub.Domain.Enums;

namespace AiTicketHub.Application.Services;

public class TicketImportService : ITicketImportService
{
    private readonly ICsvTicketParser  _csvParser;
    private readonly IJsonTicketParser _jsonParser;
    private readonly IXmlTicketParser  _xmlParser;
    private readonly ITicketRepository _repository;

    public TicketImportService(
        ICsvTicketParser  csvParser,
        IJsonTicketParser jsonParser,
        IXmlTicketParser  xmlParser,
        ITicketRepository repository)
    {
        _csvParser  = csvParser;
        _jsonParser = jsonParser;
        _xmlParser  = xmlParser;
        _repository = repository;
    }

    public async Task<ImportTicketsResponse> ImportAsync(Stream input, string format, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(format, nameof(format));
        var parseResult = format.ToLowerInvariant() switch
        {
            "csv"  => await _csvParser.ParseAsync(input, ct),
            "json" => await _jsonParser.ParseAsync(input, ct),
            "xml"  => await _xmlParser.ParseAsync(input, ct),
            _      => throw new ArgumentException($"Unsupported format '{format}'.", nameof(format))
        };

        var allErrors = parseResult.Errors
            .Select(e => new ImportErrorItem(e.RowNumber, e.Message))
            .ToList();

        var tickets = parseResult.Records
            .Select(MapToTicket)
            .ToList();

        int successful = 0;

        if (tickets.Count > 0)
        {
            var bulkResults = await _repository.BulkAddAsync(tickets);
            for (int i = 0; i < bulkResults.Count; i++)
            {
                if (bulkResults[i].IsSuccess)
                    successful++;
                else
                    allErrors.Add(new ImportErrorItem(i + 1, bulkResults[i].Error!.Message));
            }
        }

        int total  = parseResult.Records.Count + parseResult.Errors.Count;
        int failed = total - successful;

        return new ImportTicketsResponse(total, successful, failed, allErrors);
    }

    private static Ticket MapToTicket(TicketImportRecord r) =>
        new Ticket(
            Guid.NewGuid(),
            r.CustomerId,
            r.CustomerEmail,
            r.CustomerName,
            r.Subject,
            r.Description,
            r.Category,
            r.Priority,
            r.Status ?? TicketStatus.New,
            DateTime.UtcNow,
            DateTime.UtcNow,
            null,
            r.AssignedTo,
            r.Tags ?? new List<string>(),
            r.Source ?? TicketSource.WebForm,
            r.Browser,
            r.DeviceType ?? DeviceType.Desktop);
}
