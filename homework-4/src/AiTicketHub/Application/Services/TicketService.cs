// src/AiTicketHub/Application/Services/TicketService.cs
using AiTicketHub.Application.DTOs;
using AiTicketHub.Application.Interfaces;
using AiTicketHub.Domain.Common;
using AiTicketHub.Domain.Entities;
using AiTicketHub.Domain.Enums;
using FluentValidation;

namespace AiTicketHub.Application.Services;

public class TicketService : ITicketService
{
    private readonly ITicketRepository _repository;
    private readonly IValidator<CreateTicketRequest> _createValidator;
    private readonly IValidator<UpdateTicketRequest> _updateValidator;
    private readonly ITicketImportService _importService;
    private readonly IClassificationService _classifier;

    public TicketService(
        ITicketRepository repository,
        IValidator<CreateTicketRequest> createValidator,
        IValidator<UpdateTicketRequest> updateValidator,
        ITicketImportService importService,
        IClassificationService classifier)
    {
        _repository      = repository;
        _createValidator = createValidator;
        _updateValidator = updateValidator;
        _importService   = importService;
        _classifier      = classifier;
    }

    public async Task<Result<CreateTicketResponse>> CreateTicketAsync(CreateTicketRequest request)
    {
        var validation = await _createValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return Result<CreateTicketResponse>.Failure(new Error(
                Errors.ValidationFailed.Code,
                string.Join("; ", validation.Errors.Select(e => e.ErrorMessage))));

        var ticket = new Ticket(
            Guid.NewGuid(),
            request.CustomerId,
            request.CustomerEmail,
            request.CustomerName,
            request.Subject,
            request.Description,
            request.Category,
            request.Priority,
            TicketStatus.New,
            DateTime.UtcNow,
            DateTime.UtcNow,
            null,
            request.AssignedTo,
            request.Tags,
            request.Source,
            request.Browser,
            request.DeviceType);

        var addResult = await _repository.AddAsync(ticket);
        if (!addResult.IsSuccess)
            return Result<CreateTicketResponse>.Failure(addResult.Error!);

        if (request.AutoClassify)
        {
            var classification = _classifier.Classify(ticket.Subject, ticket.Description);
            ticket.ApplyClassification(classification.Category, classification.Priority);
        }

        return Result<CreateTicketResponse>.Success(MapToCreateResponse(ticket));
    }

    public async Task<Result<GetTicketByIdResponse>> GetTicketByIdAsync(Guid id)
    {
        var getResult = await _repository.GetByIdAsync(id);
        if (!getResult.IsSuccess)
            return Result<GetTicketByIdResponse>.Failure(getResult.Error!);

        return Result<GetTicketByIdResponse>.Success(MapToGetByIdResponse(getResult.Value!));
    }

    public async Task<Result<ListTicketsResponse>> ListTicketsAsync(ListTicketsRequest request)
    {
        var allResult = await _repository.GetAllAsync();
        if (!allResult.IsSuccess)
            return Result<ListTicketsResponse>.Failure(allResult.Error!);

        var filtered = allResult.Value!
            .Where(t => !request.Category.HasValue  || t.Category   == request.Category.Value)
            .Where(t => !request.Priority.HasValue  || t.Priority   == request.Priority.Value)
            .Where(t => !request.Status.HasValue    || t.Status     == request.Status.Value)
            .Where(t => request.AssignedTo == null  || t.AssignedTo == request.AssignedTo)
            .ToList();

        var total    = allResult.Value!.Count;
        var page     = request.Page     < 1 ? 1  : request.Page;
        var pageSize = request.PageSize < 1 ? 20 : request.PageSize;

        var items = filtered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(MapToTicketListItem)
            .ToList();

        return Result<ListTicketsResponse>.Success(new ListTicketsResponse(items, total, page, pageSize));
    }

    public async Task<Result<UpdateTicketResponse>> UpdateTicketAsync(Guid id, UpdateTicketRequest request)
    {
        var validation = await _updateValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return Result<UpdateTicketResponse>.Failure(new Error(
                Errors.ValidationFailed.Code,
                string.Join("; ", validation.Errors.Select(e => e.ErrorMessage))));

        var getResult = await _repository.GetByIdAsync(id);
        if (!getResult.IsSuccess)
            return Result<UpdateTicketResponse>.Failure(getResult.Error!);

        var ticket = getResult.Value!;

        if (request.Status.HasValue && request.Status.Value != ticket.Status)
        {
            var transitionResult = ticket.TransitionTo(request.Status.Value);
            if (!transitionResult.IsSuccess)
                return Result<UpdateTicketResponse>.Failure(transitionResult.Error!);
        }

        ticket.ApplyUpdate(
            request.Subject,
            request.Description,
            request.Category,
            request.Priority,
            request.AssignedTo,
            request.Tags,
            request.Browser,
            request.DeviceType);

        var updateResult = await _repository.UpdateAsync(ticket);
        if (!updateResult.IsSuccess)
            return Result<UpdateTicketResponse>.Failure(updateResult.Error!);

        return Result<UpdateTicketResponse>.Success(MapToUpdateResponse(updateResult.Value!));
    }

    public async Task<Result> DeleteTicketAsync(Guid id)
    {
        var getResult = await _repository.GetByIdAsync(id);
        if (!getResult.IsSuccess)
            return Result.Failure(getResult.Error!);

        var canDelete = getResult.Value!.CanBeDeleted();
        if (!canDelete.IsSuccess)
            return Result.Failure(canDelete.Error!);

        return await _repository.DeleteAsync(id);
    }

    public async Task<Result<ImportTicketsResponse>> ImportTicketsAsync(Stream input, string format, CancellationToken ct = default)
    {
        var response = await _importService.ImportAsync(input, format, ct);
        return Result<ImportTicketsResponse>.Success(response);
    }

    public async Task<Result<AutoClassifyResponse>> AutoClassifyAsync(Guid id, AutoClassifyRequest request)
    {
        var getResult = await _repository.GetByIdAsync(id);
        if (!getResult.IsSuccess)
            return Result<AutoClassifyResponse>.Failure(getResult.Error!);

        var ticket         = getResult.Value!;
        var classification = _classifier.Classify(ticket.Subject, ticket.Description);

        var category = request.CategoryOverride ?? classification.Category;
        var priority = request.PriorityOverride ?? classification.Priority;

        var updateResult = await _repository.UpdateClassificationAsync(id, category, priority);
        if (!updateResult.IsSuccess)
            return Result<AutoClassifyResponse>.Failure(updateResult.Error!);

        return Result<AutoClassifyResponse>.Success(new AutoClassifyResponse(
            category,
            priority,
            classification.Confidence,
            classification.Reasoning,
            classification.KeywordsFound));
    }

    private static CreateTicketResponse MapToCreateResponse(Ticket t) =>
        new(t.Id, t.CustomerId, t.CustomerEmail, t.CustomerName,
            t.Subject, t.Description, t.Category, t.Priority,
            t.Status, t.CreatedAt, t.UpdatedAt, t.ResolvedAt,
            t.AssignedTo, t.Tags,
            new TicketMetadata(t.Source, t.Browser, t.DeviceType));

    private static GetTicketByIdResponse MapToGetByIdResponse(Ticket t) =>
        new(t.Id, t.CustomerId, t.CustomerEmail, t.CustomerName,
            t.Subject, t.Description, t.Category, t.Priority,
            t.Status, t.CreatedAt, t.UpdatedAt, t.ResolvedAt,
            t.AssignedTo, t.Tags,
            new TicketMetadata(t.Source, t.Browser, t.DeviceType));

    private static UpdateTicketResponse MapToUpdateResponse(Ticket t) =>
        new(t.Id, t.CustomerId, t.CustomerEmail, t.CustomerName,
            t.Subject, t.Description, t.Category, t.Priority,
            t.Status, t.CreatedAt, t.UpdatedAt, t.ResolvedAt,
            t.AssignedTo, t.Tags,
            new TicketMetadata(t.Source, t.Browser, t.DeviceType));

    private static TicketListItem MapToTicketListItem(Ticket t) =>
        new(t.Id, t.CustomerId, t.CustomerEmail, t.CustomerName,
            t.Subject, t.Description, t.Category, t.Priority,
            t.Status, t.CreatedAt, t.UpdatedAt, t.ResolvedAt,
            t.AssignedTo, t.Tags,
            new TicketMetadata(t.Source, t.Browser, t.DeviceType));
}
