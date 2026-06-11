using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using TicketManagementApi.Models;

namespace TicketManagementApi.Repositories;

public class InMemoryTicketRepository : ITicketRepository
{
    private readonly ConcurrentDictionary<Guid, Ticket> _tickets = new();

    public Task<Ticket> CreateAsync(Ticket ticket)
    {
        if (ticket.Id == Guid.Empty)
        {
            ticket.Id = Guid.NewGuid();
        }
        
        var now = DateTime.UtcNow;
        ticket.CreatedAt = now;
        ticket.UpdatedAt = now;

        _tickets[ticket.Id] = ticket;
        return Task.FromResult(ticket);
    }

    public Task<Ticket?> GetByIdAsync(Guid id)
    {
        _tickets.TryGetValue(id, out var ticket);
        return Task.FromResult(ticket);
    }

    public Task<IEnumerable<Ticket>> GetAllAsync(
        TicketCategory? category = null,
        TicketPriority? priority = null,
        TicketStatus? status = null,
        string? customerId = null,
        string? tag = null)
    {
        IEnumerable<Ticket> query = _tickets.Values;

        if (category.HasValue)
        {
            query = query.Where(t => t.Category == category.Value);
        }

        if (priority.HasValue)
        {
            query = query.Where(t => t.Priority == priority.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(t => t.Status == status.Value);
        }

        if (!string.IsNullOrEmpty(customerId))
        {
            query = query.Where(t => t.CustomerId.Equals(customerId, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrEmpty(tag))
        {
            query = query.Where(t => t.Tags.Contains(tag, StringComparer.OrdinalIgnoreCase));
        }

        return Task.FromResult(query.OrderByDescending(t => t.CreatedAt).AsEnumerable());
    }

    public Task<Ticket?> UpdateAsync(Ticket ticket)
    {
        if (!_tickets.ContainsKey(ticket.Id))
        {
            return Task.FromResult<Ticket?>(null);
        }

        ticket.UpdatedAt = DateTime.UtcNow;
        if (ticket.Status == TicketStatus.resolved || ticket.Status == TicketStatus.closed)
        {
            ticket.ResolvedAt ??= DateTime.UtcNow;
        }
        else
        {
            ticket.ResolvedAt = null;
        }

        _tickets[ticket.Id] = ticket;
        return Task.FromResult<Ticket?>(ticket);
    }

    public Task<bool> DeleteAsync(Guid id)
    {
        return Task.FromResult(_tickets.TryRemove(id, out _));
    }

    public Task ClearAsync()
    {
        _tickets.Clear();
        return Task.CompletedTask;
    }
}
