// src/AiTicketHub/Application/Interfaces/ITicketService.cs
using AiTicketHub.Application.DTOs;
using AiTicketHub.Domain.Common;

namespace AiTicketHub.Application.Interfaces;

public interface ITicketService
{
    Task<Result<CreateTicketResponse>>    CreateTicketAsync(CreateTicketRequest request);
    Task<Result<GetTicketByIdResponse>>   GetTicketByIdAsync(Guid id);
    Task<Result<ListTicketsResponse>>     ListTicketsAsync(ListTicketsRequest request);
    Task<Result<UpdateTicketResponse>>    UpdateTicketAsync(Guid id, UpdateTicketRequest request);
    Task<Result>                          DeleteTicketAsync(Guid id);
    Task<Result<ImportTicketsResponse>>   ImportTicketsAsync(Stream input, string format, CancellationToken ct = default);
    Task<Result<AutoClassifyResponse>>    AutoClassifyAsync(Guid id, AutoClassifyRequest request);
}
