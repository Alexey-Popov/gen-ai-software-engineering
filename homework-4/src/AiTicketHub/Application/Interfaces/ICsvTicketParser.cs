// src/AiTicketHub/Application/Interfaces/ICsvTicketParser.cs
using AiTicketHub.Application.Import;

namespace AiTicketHub.Application.Interfaces;

public interface ICsvTicketParser
{
    Task<ParseResult<TicketImportRecord>> ParseAsync(Stream input, CancellationToken ct = default);
}
