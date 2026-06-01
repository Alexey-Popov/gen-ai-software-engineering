// tests/AiTicketHub.Tests/Infrastructure/KeywordClassifierTests.cs
using AiTicketHub.Domain.Enums;
using AiTicketHub.Infrastructure.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;

namespace AiTicketHub.Tests.Infrastructure;

[TestFixture]
public class KeywordClassifierTests
{
    private KeywordClassifier _classifier = null!;

    [SetUp]
    public void SetUp() => _classifier = new KeywordClassifier(NullLogger<KeywordClassifier>.Instance);

    // ── Category classification ─────────────────────────────────────────────

    [Test]
    public void Classify_LoginKeyword_ReturnsAccountAccessCategory()
    {
        var result = _classifier.Classify("login issue", "cannot login");

        result.Category.Should().Be(TicketCategory.AccountAccess);
    }

    [Test]
    public void Classify_PasswordKeyword_ReturnsAccountAccessCategory()
    {
        var result = _classifier.Classify("password reset", "my password is not working");

        result.Category.Should().Be(TicketCategory.AccountAccess);
    }

    [Test]
    public void Classify_PaymentKeyword_ReturnsBillingQuestionCategory()
    {
        var result = _classifier.Classify("payment problem", "my payment failed");

        result.Category.Should().Be(TicketCategory.BillingQuestion);
    }

    [Test]
    public void Classify_BugKeyword_ReturnsBugReportCategory()
    {
        var result = _classifier.Classify("bug in app", "there is a bug");

        result.Category.Should().Be(TicketCategory.BugReport);
    }

    [Test]
    public void Classify_EnhancementKeyword_ReturnsFeatureRequestCategory()
    {
        var result = _classifier.Classify("enhancement request", "please add an enhancement");

        result.Category.Should().Be(TicketCategory.FeatureRequest);
    }

    [Test]
    public void Classify_TechnicalKeyword_ReturnsTechnicalIssueCategory()
    {
        var result = _classifier.Classify("technical problem", "technical issue with service");

        result.Category.Should().Be(TicketCategory.TechnicalIssue);
    }

    [Test]
    public void Classify_NoKeywords_ReturnsOtherCategory()
    {
        var result = _classifier.Classify("general inquiry", "I have a question");

        result.Category.Should().Be(TicketCategory.Other);
    }

    // ── Priority classification ─────────────────────────────────────────────

    [Test]
    public void Classify_CriticalKeyword_ReturnsUrgentPriority()
    {
        var result = _classifier.Classify("critical outage", "this is critical");

        result.Priority.Should().Be(TicketPriority.Urgent);
    }

    [Test]
    public void Classify_SecurityKeyword_ReturnsUrgentPriority()
    {
        var result = _classifier.Classify("security breach", "possible security vulnerability");

        result.Priority.Should().Be(TicketPriority.Urgent);
    }

    [Test]
    public void Classify_ImportantKeyword_ReturnsHighPriority()
    {
        var result = _classifier.Classify("important issue", "this is important");

        result.Priority.Should().Be(TicketPriority.High);
    }

    [Test]
    public void Classify_BlockingKeyword_ReturnsHighPriority()
    {
        var result = _classifier.Classify("blocking deployment", "this is blocking our team");

        result.Priority.Should().Be(TicketPriority.High);
    }

    [Test]
    public void Classify_MinorKeyword_ReturnsLowPriority()
    {
        var result = _classifier.Classify("minor issue", "just a minor thing");

        result.Priority.Should().Be(TicketPriority.Low);
    }

    [Test]
    public void Classify_CosmeticKeyword_ReturnsLowPriority()
    {
        var result = _classifier.Classify("cosmetic change", "a cosmetic fix needed");

        result.Priority.Should().Be(TicketPriority.Low);
    }

    [Test]
    public void Classify_NoPriorityKeywords_ReturnsMediumPriority()
    {
        var result = _classifier.Classify("general inquiry", "I have a question");

        result.Priority.Should().Be(TicketPriority.Medium);
    }

    // ── Confidence bounds ───────────────────────────────────────────────────

    [Test]
    public void Classify_NoKeywords_ReturnsZeroConfidence()
    {
        var result = _classifier.Classify("general inquiry", "I have a question");

        result.Confidence.Should().Be(0.0);
    }

    [Test]
    public void Classify_WithMatchingKeywords_ReturnsPositiveConfidence()
    {
        var result = _classifier.Classify("login password bug", "critical payment issue");

        result.Confidence.Should().BeGreaterThan(0.0);
    }

    [Test]
    public void Classify_WithMatchingKeywords_ConfidenceNeverExceedsOne()
    {
        var result = _classifier.Classify("login password 2fa payment invoice refund bug crash", "critical security");

        result.Confidence.Should().BeLessThanOrEqualTo(1.0);
    }

    // ── Reasoning ───────────────────────────────────────────────────────────

    [Test]
    public void Classify_NoKeywords_ReasoningIndicatesDefault()
    {
        var result = _classifier.Classify("general inquiry", "I have a question");

        result.Reasoning.Should().Contain("No keywords matched");
    }

    [Test]
    public void Classify_WithKeywords_ReasoningIndicatesMatched()
    {
        var result = _classifier.Classify("login issue", "cannot login");

        result.Reasoning.Should().Contain("Matched keywords");
    }

    // ── KeywordsFound ───────────────────────────────────────────────────────

    [Test]
    public void Classify_NoKeywords_KeywordsFoundIsEmpty()
    {
        var result = _classifier.Classify("general inquiry", "I have a question");

        result.KeywordsFound.Should().BeEmpty();
    }

    [Test]
    public void Classify_LoginKeyword_KeywordsFoundContainsLogin()
    {
        var result = _classifier.Classify("login issue", "cannot login");

        result.KeywordsFound.Should().Contain("login");
    }

    [Test]
    public void Classify_MultipleKeywords_KeywordsFoundContainsAllMatched()
    {
        var result = _classifier.Classify("login password issue", "cannot login with my password");

        result.KeywordsFound.Should().Contain("login").And.Contain("password");
    }
}
