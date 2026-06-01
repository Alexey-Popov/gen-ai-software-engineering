// src/AiTicketHub/API/Controllers/TicketController.cs
using AiTicketHub.Application.DTOs;
using AiTicketHub.Application.Interfaces;
using AiTicketHub.Domain.Common;
using AiTicketHub.Domain.Enums;
using Microsoft.AspNetCore.Mvc;

namespace AiTicketHub.API.Controllers;

[ApiController]
[Route("api/tickets")]
public class TicketController : ControllerBase
{
    private readonly ITicketService _service;

    public TicketController(ITicketService service) => _service = service;

    [HttpPost]
    public async Task<IActionResult> CreateTicket([FromBody] CreateTicketRequest request)
    {
        var result = await _service.CreateTicketAsync(request);
        if (!result.IsSuccess) return MapError(result.Error!);
        return CreatedAtAction(nameof(GetTicketById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetTicketById(Guid id)
    {
        var result = await _service.GetTicketByIdAsync(id);
        if (!result.IsSuccess) return MapError(result.Error!);
        return Ok(result.Value);
    }

    [HttpGet]
    public async Task<IActionResult> ListTickets(
        [FromQuery] TicketCategory? category,
        [FromQuery] TicketPriority? priority,
        [FromQuery] TicketStatus?   status,
        [FromQuery] string?         assignedTo,
        [FromQuery] int             page     = 1,
        [FromQuery] int             pageSize = 20)
    {
        var request = new ListTicketsRequest(category, priority, status, assignedTo, page, pageSize);
        var result  = await _service.ListTicketsAsync(request);
        if (!result.IsSuccess) return MapError(result.Error!);
        return Ok(result.Value);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateTicket(Guid id, [FromBody] UpdateTicketRequest request)
    {
        var result = await _service.UpdateTicketAsync(id, request);
        if (!result.IsSuccess) return MapError(result.Error!);
        return Ok(result.Value);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteTicket(Guid id)
    {
        var result = await _service.DeleteTicketAsync(id);
        if (!result.IsSuccess) return MapError(result.Error!);
        return NoContent();
    }

    [HttpPost("import")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> ImportTickets(IFormFile? file, CancellationToken ct)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { code = "Validation.Failed", message = "A non-empty file is required." });

        if (file.Length > 10 * 1024 * 1024)
            return BadRequest(new { code = "Validation.Failed", message = "File exceeds the 10 MB size limit." });

        var format = DetectFormat(file.ContentType, Path.GetExtension(file.FileName));
        if (format == null)
            return BadRequest(new { code = "Validation.Failed", message = "Unsupported file format. Allowed: CSV, JSON, XML." });

        await using var stream = file.OpenReadStream();
        var result = await _service.ImportTicketsAsync(stream, format, ct);
        if (!result.IsSuccess) return MapError(result.Error!);
        return Ok(result.Value);
    }

    [HttpPost("{id:guid}/auto-classify")]
    public async Task<IActionResult> AutoClassify(Guid id, [FromBody] AutoClassifyRequest? request)
    {
        var result = await _service.AutoClassifyAsync(id, request ?? new AutoClassifyRequest());
        if (!result.IsSuccess) return MapError(result.Error!);
        return Ok(result.Value);
    }

    private static string? DetectFormat(string? contentType, string? extension)
    {
        var ct  = contentType?.ToLowerInvariant() ?? string.Empty;
        var ext = extension?.ToLowerInvariant()   ?? string.Empty;

        if (ct.Contains("csv")  || ext == ".csv")  return "csv";
        if (ct.Contains("json") || ext == ".json") return "json";
        if (ct.Contains("xml")  || ext == ".xml")  return "xml";
        return null;
    }

    private IActionResult MapError(Error error) => error.Code switch
    {
        "Ticket.NotFound"      => NotFound(error),
        "Ticket.InvalidStatus" => UnprocessableEntity(error),
        "Ticket.Duplicate"     => Conflict(error),
        "Validation.Failed"    => BadRequest(error),
        _                      => StatusCode(500, error)
    };
}
