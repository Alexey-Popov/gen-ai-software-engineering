// src/AiTicketHub/Application/Import/ParseRowError.cs
namespace AiTicketHub.Application.Import;

public record ParseRowError(int RowNumber, string Message);
