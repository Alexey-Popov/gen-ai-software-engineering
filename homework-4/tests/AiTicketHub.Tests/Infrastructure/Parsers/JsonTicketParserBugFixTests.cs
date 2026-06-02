// tests/AiTicketHub.Tests/Infrastructure/Parsers/JsonTicketParserBugFixTests.cs
// FIRST compliance:
// F – Fast:        All input supplied as in-memory MemoryStream; no file I/O.
// I – Independent: Each test constructs its own parser and stream; no shared state.
// R – Repeatable:  Input is hard-coded; no randomness.
// S – Self-validating: Every test has a FluentAssertions .Should() call or exception check.
// T – Timely:      Tests cover only code changed in this pipeline run (BUG-022).

using System.Text;
using AiTicketHub.Infrastructure.Parsers;
using FluentAssertions;
using NUnit.Framework;

namespace AiTicketHub.Tests.Infrastructure.Parsers;

[TestFixture]
public class JsonTicketParserBugFixTests
{
    private JsonTicketParser _parser = null!;

    [SetUp]
    public void SetUp() => _parser = new JsonTicketParser();

    // ── BUG-022: ParseAsync null-input guard ──────────────────────────────

    [Test]
    public void ParseAsync_NullInput_ThrowsArgumentNullException()
    {
        Func<Task> act = () => _parser.ParseAsync(null!);
        act.Should().ThrowAsync<ArgumentNullException>();
    }
}
