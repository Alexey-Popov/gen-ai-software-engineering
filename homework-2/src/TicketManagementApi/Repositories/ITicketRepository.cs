using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using TicketManagementApi.Models;

namespace TicketManagementApi.Repositories;

public interface ITicketRepository
{
    Task<Ticket> CreateAsync(Ticket ticket);
    Task<Ticket?> GetByIdAsync(Guid id);
    Task<IEnumerable<Ticket>> GetAllAsync(
        TicketCategory? category = null,
        TicketPriority? priority = null,
        TicketStatus? status = null,
        string? customerId = null,
        string? tag = null);
    Task<Ticket?> UpdateAsync(Ticket ticket);
    Task<bool> DeleteAsync(Guid id);
    Task ClearAsync(); // Helper for tests
}
