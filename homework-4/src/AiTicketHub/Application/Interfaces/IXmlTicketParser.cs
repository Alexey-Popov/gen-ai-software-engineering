// src/AiTicketHub/Application/Interfaces/IXmlTicketParser.cs
using AiTicketHub.Application.Import;

namespace AiTicketHub.Application.Interfaces;

public interface IXmlTicketParser
{
    Task<ParseResult<TicketImportRecord>> ParseAsync(Stream input, CancellationToken ct = default);
}
