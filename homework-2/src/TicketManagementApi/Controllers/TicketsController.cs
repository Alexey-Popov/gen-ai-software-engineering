using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using TicketManagementApi.Models;
using TicketManagementApi.Repositories;
using TicketManagementApi.Services;

namespace TicketManagementApi.Controllers;

[ApiController]
[Route("tickets")]
public class TicketsController : ControllerBase
{
    private readonly ITicketRepository _repository;
    private readonly IAutoClassificationService _classifier;
    private readonly IImportService _importService;

    public TicketsController(
        ITicketRepository repository,
        IAutoClassificationService classifier,
        IImportService importService)
    {
        _repository = repository;
        _classifier = classifier;
        _importService = importService;
    }

    [HttpPost]
    public async Task<ActionResult<Ticket>> Create([FromBody] CreateTicketDto dto, [FromQuery] bool? autoClassify)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var ticket = new Ticket
        {
            CustomerId = dto.CustomerId,
            CustomerEmail = dto.CustomerEmail,
            CustomerName = dto.CustomerName,
            Subject = dto.Subject,
            Description = dto.Description,
            Status = dto.Status,
            AssignedTo = dto.AssignedTo,
            Tags = dto.Tags ?? new List<string>(),
            Metadata = new TicketMetadata
            {
                Source = dto.Metadata.Source,
                Browser = dto.Metadata.Browser,
                DeviceType = dto.Metadata.DeviceType
            }
        };

        // Determine if we should auto-classify
        bool runAutoClassify = autoClassify ?? dto.AutoClassify;

        if (runAutoClassify || !dto.Category.HasValue || !dto.Priority.HasValue)
        {
            var classification = _classifier.Classify(ticket.Subject, ticket.Description);
            
            // If the user manually provided category/priority, respect them. Otherwise use classification.
            ticket.Category = dto.Category ?? classification.Category;
            ticket.Priority = dto.Priority ?? classification.Priority;
            ticket.ClassificationConfidence = classification.Confidence;
            ticket.ClassificationReasoning = classification.Reasoning;
            ticket.ClassificationKeywords = classification.KeywordsFound;
        }
        else
        {
            ticket.Category = dto.Category.Value;
            ticket.Priority = dto.Priority.Value;
            ticket.ClassificationConfidence = 1.0;
            ticket.ClassificationReasoning = "Manually specified during creation.";
        }

        var createdTicket = await _repository.CreateAsync(ticket);
        return CreatedAtAction(nameof(GetById), new { id = createdTicket.Id }, createdTicket);
    }

    [HttpPost("import")]
    public async Task<ActionResult<ImportSummary>> Import([FromQuery] bool autoClassify = true)
    {
        var file = Request.Form.Files.FirstOrDefault();
        if (file == null || file.Length == 0)
        {
            return BadRequest(new ImportSummary
            {
                TotalRecords = 0,
                Failed = 1,
                Errors = new List<ImportError> { new ImportError { Row = 0, Error = "No file uploaded or file is empty." } }
            });
        }

        var extension = Path.GetExtension(file.FileName).TrimStart('.').ToLowerInvariant();
        if (extension != "csv" && extension != "json" && extension != "xml")
        {
            return BadRequest(new ImportSummary
            {
                TotalRecords = 0,
                Failed = 1,
                Errors = new List<ImportError> { new ImportError { Row = 0, Error = $"Unsupported file extension: .{extension}. Must be csv, json, or xml." } }
            });
        }

        using var stream = file.OpenReadStream();
        var result = await _importService.ImportTicketsAsync(stream, extension, autoClassify);

        if (result.Failed > 0 && result.Successful == 0)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Ticket>>> GetAll(
        [FromQuery] TicketCategory? category,
        [FromQuery] TicketPriority? priority,
        [FromQuery] TicketStatus? status,
        [FromQuery] string? customer_id,
        [FromQuery] string? tag)
    {
        var tickets = await _repository.GetAllAsync(category, priority, status, customer_id, tag);
        return Ok(tickets);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<Ticket>> GetById(Guid id)
    {
        var ticket = await _repository.GetByIdAsync(id);
        if (ticket == null)
        {
            return NotFound(new { error = $"Ticket with ID {id} not found." });
        }
        return Ok(ticket);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<Ticket>> Update(Guid id, [FromBody] UpdateTicketDto dto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var existingTicket = await _repository.GetByIdAsync(id);
        if (existingTicket == null)
        {
            return NotFound(new { error = $"Ticket with ID {id} not found." });
        }

        // Apply updates
        if (dto.CustomerId != null) existingTicket.CustomerId = dto.CustomerId;
        if (dto.CustomerEmail != null) existingTicket.CustomerEmail = dto.CustomerEmail;
        if (dto.CustomerName != null) existingTicket.CustomerName = dto.CustomerName;
        if (dto.Subject != null) existingTicket.Subject = dto.Subject;
        if (dto.Description != null) existingTicket.Description = dto.Description;
        if (dto.Category.HasValue)
        {
            existingTicket.Category = dto.Category.Value;
            existingTicket.ClassificationConfidence = 1.0; // manual override
            existingTicket.ClassificationReasoning = "Manually updated via PUT override.";
        }
        if (dto.Priority.HasValue)
        {
            existingTicket.Priority = dto.Priority.Value;
            existingTicket.ClassificationConfidence = 1.0; // manual override
            existingTicket.ClassificationReasoning = "Manually updated via PUT override.";
        }
        if (dto.Status.HasValue) existingTicket.Status = dto.Status.Value;
        if (dto.AssignedTo != null) existingTicket.AssignedTo = dto.AssignedTo;
        if (dto.Tags != null) existingTicket.Tags = dto.Tags;

        if (dto.Metadata != null)
        {
            existingTicket.Metadata.Source = dto.Metadata.Source;
            existingTicket.Metadata.DeviceType = dto.Metadata.DeviceType;
            if (dto.Metadata.Browser != null) existingTicket.Metadata.Browser = dto.Metadata.Browser;
        }

        var updated = await _repository.UpdateAsync(existingTicket);
        return Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var deleted = await _repository.DeleteAsync(id);
        if (!deleted)
        {
            return NotFound(new { error = $"Ticket with ID {id} not found." });
        }
        return NoContent();
    }

    [HttpPost("{id:guid}/auto-classify")]
    public async Task<ActionResult<AutoClassifyResult>> AutoClassify(Guid id)
    {
        var ticket = await _repository.GetByIdAsync(id);
        if (ticket == null)
        {
            return NotFound(new { error = $"Ticket with ID {id} not found." });
        }

        var result = _classifier.Classify(ticket.Subject, ticket.Description);

        ticket.Category = result.Category;
        ticket.Priority = result.Priority;
        ticket.ClassificationConfidence = result.Confidence;
        ticket.ClassificationReasoning = result.Reasoning;
        ticket.ClassificationKeywords = result.KeywordsFound;

        await _repository.UpdateAsync(ticket);
        return Ok(result);
    }
}
