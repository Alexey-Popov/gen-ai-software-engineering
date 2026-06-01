// src/AiTicketHub/Application/Interfaces/ITicketRepository.cs
using AiTicketHub.Domain.Common;
using AiTicketHub.Domain.Entities;
using AiTicketHub.Domain.Enums;

namespace AiTicketHub.Application.Interfaces;

public interface ITicketRepository
{
    Task<Result<Ticket>>                  AddAsync(Ticket ticket);
    Task<Result<Ticket>>                  GetByIdAsync(Guid id);
    Task<Result<IReadOnlyList<Ticket>>>   GetAllAsync();
    Task<Result<Ticket>>                  UpdateAsync(Ticket ticket);
    Task<Result>                          DeleteAsync(Guid id);
    Task<IReadOnlyList<Result<Ticket>>>   BulkAddAsync(IReadOnlyList<Ticket> tickets);
    Task<Result<Ticket>>                  UpdateClassificationAsync(Guid id, TicketCategory category, TicketPriority priority);
}
