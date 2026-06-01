// src/AiTicketHub/Application/Interfaces/IJsonTicketParser.cs
using AiTicketHub.Application.Import;

namespace AiTicketHub.Application.Interfaces;

public interface IJsonTicketParser
{
    Task<ParseResult<TicketImportRecord>> ParseAsync(Stream input, CancellationToken ct = default);
}
