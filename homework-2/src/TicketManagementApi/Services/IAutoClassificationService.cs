using TicketManagementApi.Models;

namespace TicketManagementApi.Services;

public interface IAutoClassificationService
{
    AutoClassifyResult Classify(string subject, string description);
}
