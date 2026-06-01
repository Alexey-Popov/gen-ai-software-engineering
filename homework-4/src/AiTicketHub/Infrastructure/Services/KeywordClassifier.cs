// src/AiTicketHub/Infrastructure/Services/KeywordClassifier.cs
using AiTicketHub.Application.DTOs;
using AiTicketHub.Application.Interfaces;
using AiTicketHub.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace AiTicketHub.Infrastructure.Services;

public class KeywordClassifier : IClassificationService
{
    private readonly ILogger<KeywordClassifier> _logger;

    // Ordered from most specific to least specific; first-match wins on equal score.
    private static readonly (TicketCategory Category, string[] Keywords)[] CategoryRules =
    [
        (TicketCategory.AccountAccess,   ["login", "password", "2fa"]),
        (TicketCategory.BillingQuestion, ["payment", "invoice", "refund"]),
        (TicketCategory.BugReport,       ["bug", "crash", "reproduction"]),
        (TicketCategory.FeatureRequest,  ["enhancement", "suggestion"]),
        (TicketCategory.TechnicalIssue,  ["error", "technical", "broken"]),
    ];

    // Ordered Urgent → High → Low; Medium is the default.
    private static readonly (TicketPriority Priority, string[] Keywords)[] PriorityRules =
    [
        (TicketPriority.Urgent, ["can't access", "critical", "production down", "security"]),
        (TicketPriority.High,   ["important", "blocking", "asap"]),
        (TicketPriority.Low,    ["minor", "cosmetic", "suggestion"]),
    ];

    private static readonly int TotalKeywords =
        CategoryRules.Sum(r => r.Keywords.Length) +
        PriorityRules.Sum(r => r.Keywords.Length);

    public KeywordClassifier(ILogger<KeywordClassifier> logger) => _logger = logger;

    public ClassificationResult Classify(string subject, string description)
    {
        var text = $"{subject} {description}".ToLowerInvariant();
        var found = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        // Score each category by keyword hits; first rule with the highest score wins.
        TicketCategory category = TicketCategory.Other;
        int bestScore = 0;

        foreach (var (cat, keywords) in CategoryRules)
        {
            int score = 0;
            foreach (var kw in keywords)
            {
                if (!text.Contains(kw)) continue;
                score++;
                found.Add(kw);
            }

            if (score > bestScore)
            {
                bestScore = score;
                category = cat;
            }
        }

        // Collect remaining category keywords that matched but didn't win.
        foreach (var (_, keywords) in CategoryRules)
            foreach (var kw in keywords)
                if (text.Contains(kw)) found.Add(kw);

        // Determine priority; first rule whose any keyword matches wins.
        TicketPriority priority = TicketPriority.Medium;
        foreach (var (pri, keywords) in PriorityRules)
        {
            foreach (var kw in keywords)
            {
                if (!text.Contains(kw)) continue;
                found.Add(kw);
                priority = pri;
                goto priorityResolved;
            }
        }
        priorityResolved:

        // Collect all remaining priority keywords that matched.
        foreach (var (_, keywords) in PriorityRules)
            foreach (var kw in keywords)
                if (text.Contains(kw)) found.Add(kw);

        var keywordsFound = found.ToList();
        double confidence = TotalKeywords == 0
            ? 0.0
            : Math.Round(Math.Clamp((double)keywordsFound.Count / TotalKeywords, 0.0, 1.0), 4);

        var reasoning = keywordsFound.Count == 0
            ? $"No keywords matched; defaulted to category '{category}' and priority '{priority}'."
            : $"Matched keywords [{string.Join(", ", keywordsFound)}] — category '{category}', priority '{priority}'.";

        _logger.LogInformation(
            "AutoClassify: Category={Category}, Priority={Priority}, Confidence={Confidence:F4}, Keywords=[{Keywords}]",
            category, priority, confidence, string.Join(", ", keywordsFound));

        return new ClassificationResult(category, priority, confidence, reasoning, keywordsFound);
    }
}
