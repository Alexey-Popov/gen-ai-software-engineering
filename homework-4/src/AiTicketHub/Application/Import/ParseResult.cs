// src/AiTicketHub/Application/Import/ParseResult.cs
namespace AiTicketHub.Application.Import;

public record ParseResult<T>(
    IReadOnlyList<T> Records,
    IReadOnlyList<ParseRowError> Errors)
{
    public bool HasErrors => Errors.Count > 0;
}
