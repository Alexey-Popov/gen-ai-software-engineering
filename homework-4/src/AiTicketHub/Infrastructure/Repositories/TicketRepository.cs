// src/AiTicketHub/Infrastructure/Repositories/TicketRepository.cs
using System.Collections.Concurrent;
using AiTicketHub.Application.Interfaces;
using AiTicketHub.Domain.Common;
using AiTicketHub.Domain.Entities;
using AiTicketHub.Domain.Enums;


namespace AiTicketHub.Infrastructure.Repositories;

public class TicketRepository : ITicketRepository
{
    private readonly ConcurrentDictionary<Guid, Ticket> _store = new();

    public Task<Result<Ticket>> AddAsync(Ticket ticket)
    {
        if (!_store.TryAdd(ticket.Id, ticket))
            return Task.FromResult(Result<Ticket>.Failure(Errors.TicketDuplicate));

        return Task.FromResult(Result<Ticket>.Success(ticket));
    }

    public Task<Result<Ticket>> GetByIdAsync(Guid id)
    {
        if (!_store.TryGetValue(id, out var ticket))
            return Task.FromResult(Result<Ticket>.Failure(Errors.TicketNotFound));

        return Task.FromResult(Result<Ticket>.Success(ticket));
    }

    public Task<Result<IReadOnlyList<Ticket>>> GetAllAsync()
    {
        IReadOnlyList<Ticket> list = _store.Values.ToList();
        return Task.FromResult(Result<IReadOnlyList<Ticket>>.Success(list));
    }

    public Task<Result<Ticket>> UpdateAsync(Ticket ticket)
    {
        if (!_store.TryGetValue(ticket.Id, out _))
            return Task.FromResult(Result<Ticket>.Failure(Errors.TicketNotFound));

        _store[ticket.Id] = ticket;
        return Task.FromResult(Result<Ticket>.Success(ticket));
    }

    public Task<Result> DeleteAsync(Guid id)
    {
        if (!_store.TryRemove(id, out _))
            return Task.FromResult(Result.Failure(Errors.TicketNotFound));

        return Task.FromResult(Result.Success());
    }

    public Task<IReadOnlyList<Result<Ticket>>> BulkAddAsync(IReadOnlyList<Ticket> tickets)
    {
        var results = new List<Result<Ticket>>(tickets.Count);
        foreach (var ticket in tickets)
        {
            results.Add(_store.TryAdd(ticket.Id, ticket)
                ? Result<Ticket>.Success(ticket)
                : Result<Ticket>.Failure(Errors.TicketDuplicate));
        }
        return Task.FromResult<IReadOnlyList<Result<Ticket>>>(results);
    }

    public Task<Result<Ticket>> UpdateClassificationAsync(Guid id, TicketCategory category, TicketPriority priority)
    {
        if (!_store.TryGetValue(id, out var ticket))
            return Task.FromResult(Result<Ticket>.Failure(Errors.TicketNotFound));

        ticket.ApplyClassification(category, priority);
        _store[id] = ticket;
        return Task.FromResult(Result<Ticket>.Success(ticket));
    }
}
