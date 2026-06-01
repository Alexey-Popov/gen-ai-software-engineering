// tests/AiTicketHub.Tests/Application/TicketServiceTests.cs
using AiTicketHub.Application.DTOs;
using AiTicketHub.Application.Interfaces;
using AiTicketHub.Application.Services;
using AiTicketHub.Application.Validators;
using AiTicketHub.Domain.Common;
using AiTicketHub.Domain.Entities;
using AiTicketHub.Domain.Enums;
using FluentAssertions;
using FluentValidation;
using Moq;
using NUnit.Framework;

namespace AiTicketHub.Tests.Application;

[TestFixture]
public class TicketServiceTests
{
    private Mock<ITicketRepository>      _repoMock       = null!;
    private Mock<IClassificationService> _classifierMock = null!;
    private Mock<ITicketImportService>   _importMock     = null!;
    private TicketService                _service        = null!;

    [SetUp]
    public void SetUp()
    {
        _repoMock       = new Mock<ITicketRepository>();
        _classifierMock = new Mock<IClassificationService>();
        _importMock     = new Mock<ITicketImportService>();

        _service = new TicketService(
            _repoMock.Object,
            new CreateTicketValidator(),
            new UpdateTicketValidator(),
            _importMock.Object,
            _classifierMock.Object);
    }

    // ── GetTicketById ───────────────────────────────────────────────────────────

    [Test]
    public async Task GetTicketByIdAsync_ExistingId_ReturnsSuccess()
    {
        var ticket = MakeTicket("My subject", "My long description");
        _repoMock.Setup(r => r.GetByIdAsync(ticket.Id))
                 .ReturnsAsync(Result<Ticket>.Success(ticket));

        var result = await _service.GetTicketByIdAsync(ticket.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(ticket.Id);
        result.Value.Subject.Should().Be(ticket.Subject);
    }

    [Test]
    public async Task GetTicketByIdAsync_NonExistentId_ReturnsNotFound()
    {
        _repoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>()))
                 .ReturnsAsync(Result<Ticket>.Failure(Errors.TicketNotFound));

        var result = await _service.GetTicketByIdAsync(Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be("Ticket.NotFound");
    }

    // ── ListTickets ─────────────────────────────────────────────────────────────

    [Test]
    public async Task ListTicketsAsync_EmptyRepository_ReturnsEmptyList()
    {
        _repoMock.Setup(r => r.GetAllAsync())
                 .ReturnsAsync(Result<IReadOnlyList<Ticket>>.Success(new List<Ticket>()));

        var result = await _service.ListTicketsAsync(new ListTicketsRequest(null, null, null, null, 1, 20));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().BeEmpty();
        result.Value.TotalCount.Should().Be(0);
    }

    [Test]
    public async Task ListTicketsAsync_FilterByCategory_ReturnsOnlyMatchingTickets()
    {
        var t1 = MakeTicketWith(TicketCategory.AccountAccess, TicketPriority.Medium, TicketStatus.New);
        var t2 = MakeTicketWith(TicketCategory.BillingQuestion, TicketPriority.High, TicketStatus.New);
        _repoMock.Setup(r => r.GetAllAsync())
                 .ReturnsAsync(Result<IReadOnlyList<Ticket>>.Success(new List<Ticket> { t1, t2 }));

        var result = await _service.ListTicketsAsync(
            new ListTicketsRequest(TicketCategory.AccountAccess, null, null, null, 1, 20));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(1);
        result.Value.Items[0].Category.Should().Be(TicketCategory.AccountAccess);
    }

    [Test]
    public async Task ListTicketsAsync_FilterByStatus_ReturnsOnlyMatchingTickets()
    {
        var t1 = MakeTicketWith(TicketCategory.Other, TicketPriority.Medium, TicketStatus.New);
        var t2 = MakeTicketWith(TicketCategory.Other, TicketPriority.Medium, TicketStatus.InProgress);
        _repoMock.Setup(r => r.GetAllAsync())
                 .ReturnsAsync(Result<IReadOnlyList<Ticket>>.Success(new List<Ticket> { t1, t2 }));

        var result = await _service.ListTicketsAsync(
            new ListTicketsRequest(null, null, TicketStatus.InProgress, null, 1, 20));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(1);
        result.Value.Items[0].Status.Should().Be(TicketStatus.InProgress);
    }

    [Test]
    public async Task ListTicketsAsync_Pagination_ReturnsCorrectPage()
    {
        var tickets = Enumerable.Range(1, 5)
            .Select(i => MakeTicket($"Subject {i}", "A long enough description"))
            .ToList();
        _repoMock.Setup(r => r.GetAllAsync())
                 .ReturnsAsync(Result<IReadOnlyList<Ticket>>.Success(tickets));

        var result = await _service.ListTicketsAsync(
            new ListTicketsRequest(null, null, null, null, 2, 2));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value.TotalCount.Should().Be(5);
        result.Value.Page.Should().Be(2);
    }

    // ── UpdateTicket ────────────────────────────────────────────────────────────

    [Test]
    public async Task UpdateTicketAsync_ValidRequest_ReturnsSuccess()
    {
        var ticket  = MakeTicket("Old subject", "Old description text");
        var request = new UpdateTicketRequest("New subject", null, null, null, null, null, null, null, null);

        _repoMock.Setup(r => r.GetByIdAsync(ticket.Id))
                 .ReturnsAsync(Result<Ticket>.Success(ticket));
        _repoMock.Setup(r => r.UpdateAsync(It.IsAny<Ticket>()))
                 .ReturnsAsync((Ticket t) => Result<Ticket>.Success(t));

        var result = await _service.UpdateTicketAsync(ticket.Id, request);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Subject.Should().Be("New subject");
    }

    [Test]
    public async Task UpdateTicketAsync_SubjectTooLong_ReturnsValidationFailed()
    {
        var request = new UpdateTicketRequest(new string('x', 201), null, null, null, null, null, null, null, null);

        var result = await _service.UpdateTicketAsync(Guid.NewGuid(), request);

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be("Validation.Failed");
        _repoMock.Verify(r => r.GetByIdAsync(It.IsAny<Guid>()), Times.Never);
    }

    [Test]
    public async Task UpdateTicketAsync_TicketNotFound_ReturnsNotFound()
    {
        var request = new UpdateTicketRequest(null, null, null, null, null, null, null, null, null);
        _repoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>()))
                 .ReturnsAsync(Result<Ticket>.Failure(Errors.TicketNotFound));

        var result = await _service.UpdateTicketAsync(Guid.NewGuid(), request);

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be("Ticket.NotFound");
    }

    [Test]
    public async Task UpdateTicketAsync_InvalidStatusTransition_ReturnsInvalidStatus()
    {
        var ticket  = MakeTicket("Subject", "Description text here"); // Status = New
        var request = new UpdateTicketRequest(null, null, null, null, TicketStatus.Resolved, null, null, null, null);

        _repoMock.Setup(r => r.GetByIdAsync(ticket.Id))
                 .ReturnsAsync(Result<Ticket>.Success(ticket));

        var result = await _service.UpdateTicketAsync(ticket.Id, request);

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be("Ticket.InvalidStatus");
    }

    // ── DeleteTicket ────────────────────────────────────────────────────────────

    [Test]
    public async Task DeleteTicketAsync_ValidTicket_ReturnsSuccess()
    {
        var ticket = MakeTicket("Subject", "Description text here"); // Status = New → deletable
        _repoMock.Setup(r => r.GetByIdAsync(ticket.Id))
                 .ReturnsAsync(Result<Ticket>.Success(ticket));
        _repoMock.Setup(r => r.DeleteAsync(ticket.Id))
                 .ReturnsAsync(Result.Success());

        var result = await _service.DeleteTicketAsync(ticket.Id);

        result.IsSuccess.Should().BeTrue();
    }

    [Test]
    public async Task DeleteTicketAsync_TicketNotFound_ReturnsNotFound()
    {
        _repoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>()))
                 .ReturnsAsync(Result<Ticket>.Failure(Errors.TicketNotFound));

        var result = await _service.DeleteTicketAsync(Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be("Ticket.NotFound");
    }

    [Test]
    public async Task DeleteTicketAsync_ResolvedTicket_ReturnsInvalidStatus()
    {
        var ticket = MakeTicketWith(TicketCategory.Other, TicketPriority.Medium, TicketStatus.Resolved);
        _repoMock.Setup(r => r.GetByIdAsync(ticket.Id))
                 .ReturnsAsync(Result<Ticket>.Success(ticket));

        var result = await _service.DeleteTicketAsync(ticket.Id);

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be("Ticket.InvalidStatus");
    }

    [Test]
    public async Task DeleteTicketAsync_ClosedTicket_ReturnsInvalidStatus()
    {
        var ticket = MakeTicketWith(TicketCategory.Other, TicketPriority.Medium, TicketStatus.Closed);
        _repoMock.Setup(r => r.GetByIdAsync(ticket.Id))
                 .ReturnsAsync(Result<Ticket>.Success(ticket));

        var result = await _service.DeleteTicketAsync(ticket.Id);

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be("Ticket.InvalidStatus");
    }

    // ── ImportTickets ───────────────────────────────────────────────────────────

    [Test]
    public async Task ImportTicketsAsync_AllSuccess_ReturnsSummaryWithZeroFailed()
    {
        var summary = new ImportTicketsResponse(3, 3, 0, []);
        _importMock.Setup(s => s.ImportAsync(It.IsAny<Stream>(), "csv", It.IsAny<CancellationToken>()))
                   .ReturnsAsync(summary);

        var result = await _service.ImportTicketsAsync(Stream.Null, "csv");

        result.IsSuccess.Should().BeTrue();
        result.Value!.Total.Should().Be(3);
        result.Value.Successful.Should().Be(3);
        result.Value.Failed.Should().Be(0);
        result.Value.Errors.Should().BeEmpty();
    }

    [Test]
    public async Task ImportTicketsAsync_PartialFailure_ReturnsSummaryWithErrors()
    {
        var summary = new ImportTicketsResponse(3, 2, 1, [new ImportErrorItem(2, "Missing CustomerId")]);
        _importMock.Setup(s => s.ImportAsync(It.IsAny<Stream>(), "json", It.IsAny<CancellationToken>()))
                   .ReturnsAsync(summary);

        var result = await _service.ImportTicketsAsync(Stream.Null, "json");

        result.IsSuccess.Should().BeTrue();
        result.Value!.Successful.Should().Be(2);
        result.Value.Failed.Should().Be(1);
        result.Value.Errors.Should().HaveCount(1);
    }

    [Test]
    public async Task ImportTicketsAsync_AllFailure_ReturnsSummaryWithAllFailed()
    {
        var summary = new ImportTicketsResponse(2, 0, 2,
            [new ImportErrorItem(1, "Error 1"), new ImportErrorItem(2, "Error 2")]);
        _importMock.Setup(s => s.ImportAsync(It.IsAny<Stream>(), "xml", It.IsAny<CancellationToken>()))
                   .ReturnsAsync(summary);

        var result = await _service.ImportTicketsAsync(Stream.Null, "xml");

        result.IsSuccess.Should().BeTrue();
        result.Value!.Successful.Should().Be(0);
        result.Value.Failed.Should().Be(2);
        result.Value.Errors.Should().HaveCount(2);
    }

    // ── CreateTicket ────────────────────────────────────────────────────────────

    [Test]
    public async Task CreateTicketAsync_ValidRequest_ReturnsSuccessWithTicketId()
    {
        var request = ValidCreateRequest();

        _repoMock.Setup(r => r.AddAsync(It.IsAny<Ticket>()))
                 .ReturnsAsync((Ticket t) => Result<Ticket>.Success(t));

        var result = await _service.CreateTicketAsync(request);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().NotBeEmpty();
        result.Value.Subject.Should().Be(request.Subject);
        result.Value.CustomerEmail.Should().Be(request.CustomerEmail);
    }

    [Test]
    public async Task CreateTicketAsync_EmptySubject_ReturnsValidationFailed()
    {
        var request = ValidCreateRequest() with { Subject = "" };

        var result = await _service.CreateTicketAsync(request);

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be("Validation.Failed");
        _repoMock.Verify(r => r.AddAsync(It.IsAny<Ticket>()), Times.Never);
    }

    [Test]
    public async Task CreateTicketAsync_InvalidEmail_ReturnsValidationFailed()
    {
        var request = ValidCreateRequest() with { CustomerEmail = "not-an-email" };

        var result = await _service.CreateTicketAsync(request);

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be("Validation.Failed");
    }

    [Test]
    public async Task CreateTicketAsync_DescriptionTooShort_ReturnsValidationFailed()
    {
        var request = ValidCreateRequest() with { Description = "short" };

        var result = await _service.CreateTicketAsync(request);

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be("Validation.Failed");
    }

    [Test]
    public async Task CreateTicketAsync_RepositoryReturnsDuplicate_ReturnsFailureWithDuplicateCode()
    {
        var request = ValidCreateRequest();

        _repoMock.Setup(r => r.AddAsync(It.IsAny<Ticket>()))
                 .ReturnsAsync(Result<Ticket>.Failure(Errors.TicketDuplicate));

        var result = await _service.CreateTicketAsync(request);

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be("Ticket.Duplicate");
    }

    // ── AutoClassify ────────────────────────────────────────────────────────────

    [Test]
    public async Task AutoClassify_TicketNotFound_ReturnsFailure()
    {
        _repoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>()))
                 .ReturnsAsync(Result<Ticket>.Failure(Errors.TicketNotFound));

        var result = await _service.AutoClassifyAsync(Guid.NewGuid(), new AutoClassifyRequest());

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be("Ticket.NotFound");
    }

    [Test]
    public async Task AutoClassify_HappyPath_ReturnsClassificationWithConfidence()
    {
        var ticket = MakeTicket("cannot login password reset", "I cannot login to my account");

        _repoMock.Setup(r => r.GetByIdAsync(ticket.Id))
                 .ReturnsAsync(Result<Ticket>.Success(ticket));

        _classifierMock.Setup(c => c.Classify(ticket.Subject, ticket.Description))
                       .Returns(new ClassificationResult(
                           TicketCategory.AccountAccess,
                           TicketPriority.Medium,
                           0.3,
                           "Matched keywords [login, password]",
                           ["login", "password"]));

        _repoMock.Setup(r => r.UpdateClassificationAsync(ticket.Id, TicketCategory.AccountAccess, TicketPriority.Medium))
                 .ReturnsAsync(Result<Ticket>.Success(ticket));

        var result = await _service.AutoClassifyAsync(ticket.Id, new AutoClassifyRequest());

        result.IsSuccess.Should().BeTrue();
        result.Value!.Category.Should().Be(TicketCategory.AccountAccess);
        result.Value!.Priority.Should().Be(TicketPriority.Medium);
        result.Value!.Confidence.Should().BeInRange(0.0, 1.0);
        result.Value!.KeywordsFound.Should().Contain("login");
    }

    [Test]
    public async Task AutoClassify_WithCategoryOverride_UsesCategoryOverride()
    {
        var ticket = MakeTicket("billing issue", "payment failed");

        _repoMock.Setup(r => r.GetByIdAsync(ticket.Id))
                 .ReturnsAsync(Result<Ticket>.Success(ticket));

        _classifierMock.Setup(c => c.Classify(It.IsAny<string>(), It.IsAny<string>()))
                       .Returns(new ClassificationResult(
                           TicketCategory.BillingQuestion,
                           TicketPriority.Medium,
                           0.2,
                           "Matched payment",
                           ["payment"]));

        _repoMock.Setup(r => r.UpdateClassificationAsync(ticket.Id, TicketCategory.FeatureRequest, TicketPriority.Medium))
                 .ReturnsAsync(Result<Ticket>.Success(ticket));

        var result = await _service.AutoClassifyAsync(
            ticket.Id,
            new AutoClassifyRequest(CategoryOverride: TicketCategory.FeatureRequest));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Category.Should().Be(TicketCategory.FeatureRequest);
    }

    [Test]
    public async Task AutoClassify_WithPriorityOverride_UsesPriorityOverride()
    {
        var ticket = MakeTicket("minor ui glitch", "button slightly misaligned");

        _repoMock.Setup(r => r.GetByIdAsync(ticket.Id))
                 .ReturnsAsync(Result<Ticket>.Success(ticket));

        _classifierMock.Setup(c => c.Classify(It.IsAny<string>(), It.IsAny<string>()))
                       .Returns(new ClassificationResult(
                           TicketCategory.TechnicalIssue,
                           TicketPriority.Low,
                           0.1,
                           "Matched minor",
                           ["minor"]));

        _repoMock.Setup(r => r.UpdateClassificationAsync(ticket.Id, TicketCategory.TechnicalIssue, TicketPriority.Urgent))
                 .ReturnsAsync(Result<Ticket>.Success(ticket));

        var result = await _service.AutoClassifyAsync(
            ticket.Id,
            new AutoClassifyRequest(PriorityOverride: TicketPriority.Urgent));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Priority.Should().Be(TicketPriority.Urgent);
    }

    // ── CreateTicket with AutoClassify flag ────────────────────────────────────

    [Test]
    public async Task CreateTicket_AutoClassifyTrue_AppliesClassification()
    {
        var request = new CreateTicketRequest(
            "cust-1", "a@b.com", "Alice", "login issue", "cannot login since 2 days",
            TicketCategory.Other, TicketPriority.Medium, TicketSource.Api,
            DeviceType.Desktop, [], null, null, AutoClassify: true);

        _classifierMock.Setup(c => c.Classify("login issue", "cannot login since 2 days"))
                       .Returns(new ClassificationResult(
                           TicketCategory.AccountAccess,
                           TicketPriority.Urgent,
                           0.25,
                           "Matched login",
                           ["login"]));

        _repoMock.Setup(r => r.AddAsync(It.IsAny<Ticket>()))
                 .ReturnsAsync((Ticket t) => Result<Ticket>.Success(t));

        var result = await _service.CreateTicketAsync(request);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Category.Should().Be(TicketCategory.AccountAccess);
        result.Value!.Priority.Should().Be(TicketPriority.Urgent);
    }

    [Test]
    public async Task CreateTicket_AutoClassifyFalse_KeepsOriginalCategory()
    {
        var request = new CreateTicketRequest(
            "cust-1", "a@b.com", "Alice", "billing question", "invoice not received",
            TicketCategory.BillingQuestion, TicketPriority.High, TicketSource.Api,
            DeviceType.Desktop, [], null, null, AutoClassify: false);

        _repoMock.Setup(r => r.AddAsync(It.IsAny<Ticket>()))
                 .ReturnsAsync((Ticket t) => Result<Ticket>.Success(t));

        var result = await _service.CreateTicketAsync(request);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Category.Should().Be(TicketCategory.BillingQuestion);
        _classifierMock.Verify(c => c.Classify(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
    }

    // ── KeywordClassifier behaviour (via real classifier) ─────────────────────

    [Test]
    public void KeywordClassifier_UrgentPriorityKeyword_SetsUrgent()
    {
        var classifier = new AiTicketHub.Infrastructure.Services.KeywordClassifier(
            Microsoft.Extensions.Logging.Abstractions.NullLogger<AiTicketHub.Infrastructure.Services.KeywordClassifier>.Instance);

        var result = classifier.Classify("production down critical", "we cannot access anything");

        result.Priority.Should().Be(TicketPriority.Urgent);
        result.Confidence.Should().BeInRange(0.0, 1.0);
        result.KeywordsFound.Should().NotBeEmpty();
    }

    [Test]
    public void KeywordClassifier_LoginKeyword_SetsAccountAccess()
    {
        var classifier = new AiTicketHub.Infrastructure.Services.KeywordClassifier(
            Microsoft.Extensions.Logging.Abstractions.NullLogger<AiTicketHub.Infrastructure.Services.KeywordClassifier>.Instance);

        var result = classifier.Classify("login problem", "I cannot login with my password");

        result.Category.Should().Be(TicketCategory.AccountAccess);
    }

    [Test]
    public void KeywordClassifier_NoKeywordsMatched_DefaultsToOtherAndMedium()
    {
        var classifier = new AiTicketHub.Infrastructure.Services.KeywordClassifier(
            Microsoft.Extensions.Logging.Abstractions.NullLogger<AiTicketHub.Infrastructure.Services.KeywordClassifier>.Instance);

        var result = classifier.Classify("hello world", "nothing special here");

        result.Category.Should().Be(TicketCategory.Other);
        result.Priority.Should().Be(TicketPriority.Medium);
        result.Confidence.Should().Be(0.0);
        result.KeywordsFound.Should().BeEmpty();
    }

    [Test]
    public void KeywordClassifier_ConfidenceAlwaysInRange()
    {
        var classifier = new AiTicketHub.Infrastructure.Services.KeywordClassifier(
            Microsoft.Extensions.Logging.Abstractions.NullLogger<AiTicketHub.Infrastructure.Services.KeywordClassifier>.Instance);

        var result = classifier.Classify(
            "login password 2fa payment invoice refund bug crash reproduction enhancement suggestion error technical broken can't access critical production down security important blocking asap minor cosmetic",
            "more keywords");

        result.Confidence.Should().BeInRange(0.0, 1.0);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private static CreateTicketRequest ValidCreateRequest() =>
        new("cust-1", "a@b.com", "Alice", "Valid subject", "Valid description text",
            TicketCategory.Other, TicketPriority.Medium, TicketSource.Api,
            DeviceType.Desktop, [], null, null);

    private static Ticket MakeTicket(string subject, string description) =>
        new(Guid.NewGuid(), "cust-1", "a@b.com", "Alice",
            subject, description,
            TicketCategory.Other, TicketPriority.Medium, TicketStatus.New,
            DateTime.UtcNow, DateTime.UtcNow, null, null, [],
            TicketSource.Api, null, DeviceType.Desktop);

    private static Ticket MakeTicketWith(TicketCategory category, TicketPriority priority, TicketStatus status) =>
        new(Guid.NewGuid(), "cust-1", "a@b.com", "Alice",
            "Subject", "Valid description text",
            category, priority, status,
            DateTime.UtcNow, DateTime.UtcNow, null, null, [],
            TicketSource.Api, null, DeviceType.Desktop);
}
