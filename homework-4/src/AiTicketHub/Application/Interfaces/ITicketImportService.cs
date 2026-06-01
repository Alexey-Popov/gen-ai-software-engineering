// src/AiTicketHub/Application/Interfaces/ITicketImportService.cs
using AiTicketHub.Application.DTOs;

namespace AiTicketHub.Application.Interfaces;

public interface ITicketImportService
{
    Task<ImportTicketsResponse> ImportAsync(Stream input, string format, CancellationToken ct = default);
}
