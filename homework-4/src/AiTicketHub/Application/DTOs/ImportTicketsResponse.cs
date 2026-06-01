// src/AiTicketHub/Application/DTOs/ImportTicketsResponse.cs
namespace AiTicketHub.Application.DTOs;

public record ImportErrorItem(int RowNumber, string Message);

public record ImportTicketsResponse(
    int Total,
    int Successful,
    int Failed,
    IReadOnlyList<ImportErrorItem> Errors);
