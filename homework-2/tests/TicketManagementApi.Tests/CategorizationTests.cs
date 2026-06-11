using Xunit;
using TicketManagementApi.Models;
using TicketManagementApi.Services;

namespace TicketManagementApi.Tests;

public class CategorizationTests
{
    private readonly IAutoClassificationService _classifier;

    public CategorizationTests()
    {
        _classifier = new AutoClassificationService(new Microsoft.Extensions.Logging.Abstractions.NullLogger<AutoClassificationService>());
    }

    [Theory]
    [InlineData("I forgot my password and cannot sign in", TicketCategory.account_access)]
    [InlineData("Please reset my credentials and lockout my 2fa", TicketCategory.account_access)]
    [InlineData("Double payment refund charge query", TicketCategory.billing_question)]
    [InlineData("I want to pay the invoice subscription amount", TicketCategory.billing_question)]
    [InlineData("Steps to reproduce the defect: click print, see crash", TicketCategory.bug_report)]
    [InlineData("Defect expected behavior mismatch", TicketCategory.bug_report)]
    [InlineData("The system is slow and returns an error code", TicketCategory.technical_issue)]
    [InlineData("App crash exception thrown during loading screen", TicketCategory.technical_issue)]
    [InlineData("Add dark mode feature suggestion", TicketCategory.feature_request)]
    [InlineData("We want to improve this list UI enhancement", TicketCategory.feature_request)]
    public void Classify_CategoryKeywords_MatchesExpectedCategory(string text, TicketCategory expectedCategory)
    {
        var result = _classifier.Classify("Issue details", text);
        Assert.Equal(expectedCategory, result.Category);
    }

    [Theory]
    [InlineData("CRITICAL database error", TicketPriority.urgent)]
    [InlineData("I can't access my security account credentials", TicketPriority.urgent)]
    [InlineData("production down: all APIs return 500", TicketPriority.urgent)]
    [InlineData("This is an important blocking issue", TicketPriority.high)]
    [InlineData("Please solve this asap", TicketPriority.high)]
    [InlineData("Minor cosmetic typo on page", TicketPriority.low)]
    [InlineData("Just a layout suggestion", TicketPriority.low)]
    [InlineData("Normal everyday question", TicketPriority.medium)]
    public void Classify_PriorityKeywords_MatchesExpectedPriority(string text, TicketPriority expectedPriority)
    {
        var result = _classifier.Classify(text, "Ticket description with details.");
        Assert.Equal(expectedPriority, result.Priority);
    }

    [Fact]
    public void Classify_NoKeywords_ReturnsOtherAndMediumWithConfidencePointFive()
    {
        var result = _classifier.Classify("Hello", "Just wanted to say thank you for the service.");

        Assert.Equal(TicketCategory.other, result.Category);
        Assert.Equal(TicketPriority.medium, result.Priority);
        Assert.Equal(0.5, result.Confidence);
        Assert.Empty(result.KeywordsFound);
    }

    [Fact]
    public void Classify_MultipleMatches_IncreasesConfidence()
    {
        var result = _classifier.Classify("reset password login locked out", "cannot login sign in profile credentials");

        // Many keywords match account_access
        Assert.Equal(TicketCategory.account_access, result.Category);
        Assert.True(result.Confidence > 0.8);
        Assert.Contains("login", result.KeywordsFound);
        Assert.Contains("password", result.KeywordsFound);
        Assert.Contains("credentials", result.KeywordsFound);
    }

    [Fact]
    public void Classify_CaseInsensitivity_MatchesCorrectly()
    {
        var result = _classifier.Classify("RESET PASSWORD LOGIN", "CANNOT ACCESS");

        Assert.Equal(TicketCategory.account_access, result.Category);
        Assert.Equal(TicketPriority.urgent, result.Priority);
        Assert.Contains("login", result.KeywordsFound);
        Assert.Contains("cannot access", result.KeywordsFound);
    }

    [Fact]
    public void Classify_PriorityOrderUrgentWins_HighOrLowPresent()
    {
        // Has both "critical" (urgent) and "asap" (high) and "minor" (low)
        var result = _classifier.Classify("critical bug asap", "minor detail");

        Assert.Equal(TicketPriority.urgent, result.Priority);
    }

    [Fact]
    public void Classify_PriorityOrderHighWins_LowPresent()
    {
        // Has both "important" (high) and "suggestion" (low)
        var result = _classifier.Classify("important bug", "suggestion detail");

        Assert.Equal(TicketPriority.high, result.Priority);
    }

    [Fact]
    public void Classify_CategoryTieBreaker_ReturnsHighestOccurrence()
    {
        // 2 billing keywords ("payment", "invoice") vs 1 account keyword ("login")
        var result = _classifier.Classify("login issue", "I made a payment for this invoice");

        Assert.Equal(TicketCategory.billing_question, result.Category);
    }

    [Fact]
    public void Classify_Reasoning_ContainsDetailsAboutMatches()
    {
        var result = _classifier.Classify("cannot login", "production down");

        Assert.Contains("Matched category 'account_access'", result.Reasoning);
        Assert.Contains("Assigned 'urgent' priority due to keyword 'production down'", result.Reasoning);
    }

    [Fact]
    public void Classify_ConfidenceCap_DoesNotExceedPointNinetyFive()
    {
        // Generate massive matches to see if confidence stays within range
        var subject = "login password 2fa credentials lockout sign in credentials reset login password";
        var description = "login password 2fa credentials lockout sign in credentials reset login password";
        
        var result = _classifier.Classify(subject, description);

        Assert.True(result.Confidence <= 0.95);
    }
}
