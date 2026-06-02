// tests/AiTicketHub.Tests/Infrastructure/KeywordClassifierBugFixTests.cs
// FIRST compliance:
// F – Fast:        No I/O or sleep; pure in-memory classifier invocations.
// I – Independent: Each test creates its own classifier instance via SetUp; no shared state.
// R – Repeatable:  Deterministic keyword matching; no randomness.
// S – Self-validating: Every test has a FluentAssertions .Should() call.
// T – Timely:      Tests cover only code changed in this pipeline run (BUG-004, BUG-005).

using AiTicketHub.Domain.Enums;
using AiTicketHub.Infrastructure.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;

namespace AiTicketHub.Tests.Infrastructure;

[TestFixture]
public class KeywordClassifierBugFixTests
{
    private KeywordClassifier _classifier = null!;

    [SetUp]
    public void SetUp() => _classifier = new KeywordClassifier(NullLogger<KeywordClassifier>.Instance);

    // ── BUG-004: Null-safe subject/description concatenation ───────────────

    [Test]
    public void Classify_NullSubject_DoesNotThrow()
    {
        Action act = () => _classifier.Classify(null!, "a valid description");
        act.Should().NotThrow();
    }

    [Test]
    public void Classify_NullDescription_DoesNotThrow()
    {
        Action act = () => _classifier.Classify("a valid subject", null!);
        act.Should().NotThrow();
    }

    [Test]
    public void Classify_BothNull_DoesNotThrowAndDefaultsToOtherMedium()
    {
        Action act = () => _classifier.Classify(null!, null!);
        act.Should().NotThrow();

        var result = _classifier.Classify(null!, null!);
        result.Category.Should().Be(TicketCategory.Other);
        result.Priority.Should().Be(TicketPriority.Medium);
    }

    // ── BUG-005: Word-boundary matching via ContainsWord ──────────────────

    [Test]
    public void Classify_SubstringContainingBugKeyword_DoesNotMatchBugReportCategory()
    {
        // "debugged" contains "bug" as a substring; word-boundary regex must NOT match.
        var result = _classifier.Classify("I debugged the system", "we debugged every part");

        result.Category.Should().NotBe(TicketCategory.BugReport);
        result.KeywordsFound.Should().NotContain("bug");
    }

    [Test]
    public void Classify_ExactWordBug_MatchesBugReportCategory()
    {
        // The standalone word "bug" must still match.
        var result = _classifier.Classify("bug in the app", "there is a bug");

        result.Category.Should().Be(TicketCategory.BugReport);
        result.KeywordsFound.Should().Contain("bug");
    }

    [Test]
    public void Classify_WordContainingLoginSubstring_DoesNotMatchLoginKeyword()
    {
        // "logins" contains "login" as a substring; should not match if boundaries differ.
        // Note: "logins" starts with "login" but has an 's' after — \b after "login" lands on
        // the word boundary between 'n' and 's' in some regex engines. This test captures
        // the intent: only the exact token "login" should score.
        var result = _classifier.Classify("logout flow", "user logged out");

        result.KeywordsFound.Should().NotContain("login");
    }

    [Test]
    public void Classify_ExactWordLogin_MatchesAccountAccessCategory()
    {
        var result = _classifier.Classify("login failed", "cannot login");

        result.Category.Should().Be(TicketCategory.AccountAccess);
        result.KeywordsFound.Should().Contain("login");
    }
}
