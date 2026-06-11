using System.IO;
using System.Threading.Tasks;
using TicketManagementApi.Models;

namespace TicketManagementApi.Services;

public interface IImportService
{
    Task<ImportSummary> ImportTicketsAsync(Stream fileStream, string format, bool autoClassify);
}
