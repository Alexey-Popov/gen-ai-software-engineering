using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Extensions.Logging;
using TicketManagementApi.Models;

namespace TicketManagementApi.Services;

public class AutoClassificationService : IAutoClassificationService
{
    private readonly ILogger<AutoClassificationService> _logger;

    // Category keyword dictionaries
    private static readonly Dictionary<TicketCategory, string[]> CategoryKeywords = new()
    {
        {
            TicketCategory.account_access,
            new[] { "login", "password", "2fa", "access", "sign in", "credentials", "lockout", "reset", "authenticator", "log in" }
        },
        {
            TicketCategory.billing_question,
            new[] { "payment", "invoice", "refund", "charge", "billing", "subscription", "price", "fee", "receipt", "card", "paypal" }
        },
        {
            TicketCategory.bug_report,
            new[] { "steps to reproduce", "reproduce", "defect", "flaw", "expected behavior", "repro", "reproduction" }
        },
        {
            TicketCategory.technical_issue,
            new[] { "bug", "error", "crash", "fail", "broken", "exception", "freeze", "glitch", "failure", "issue", "slow" }
        },
        {
            TicketCategory.feature_request,
            new[] { "feature", "suggest", "improve", "add", "request", "enhancement", "feedback", "proposal", "idea" }
        }
    };

    // Priority keywords and rules
    private static readonly string[] UrgentKeywords = { "can't access", "cannot access", "critical", "production down", "security" };
    private static readonly string[] HighKeywords = { "important", "blocking", "asap" };
    private static readonly string[] LowKeywords = { "minor", "cosmetic", "suggestion" };

    public AutoClassificationService(ILogger<AutoClassificationService> logger)
    {
        _logger = logger;
    }

    public AutoClassifyResult Classify(string subject, string description)
    {
        var textToAnalyze = $"{subject} {description}".ToLowerInvariant();
        var keywordsFound = new List<string>();

        // Analyze category
        var categoryMatches = new Dictionary<TicketCategory, int>();
        foreach (var category in Enum.GetValues<TicketCategory>())
        {
            categoryMatches[category] = 0;
        }

        foreach (var kvp in CategoryKeywords)
        {
            foreach (var keyword in kvp.Value)
            {
                int count = CountOccurrences(textToAnalyze, keyword);
                if (count > 0)
                {
                    categoryMatches[kvp.Key] += count;
                    if (!keywordsFound.Contains(keyword))
                    {
                        keywordsFound.Add(keyword);
                    }
                }
            }
        }

        // Determine final category (highest match count, fallback to "other")
        var bestCategory = TicketCategory.other;
        int maxCategoryCount = 0;

        foreach (var kvp in categoryMatches)
        {
            if (kvp.Value > maxCategoryCount)
            {
                maxCategoryCount = kvp.Value;
                bestCategory = kvp.Key;
            }
        }

        // Analyze priority
        var bestPriority = TicketPriority.medium; // default
        var matchedPriorityKeyword = string.Empty;

        // Check Urgent
        foreach (var keyword in UrgentKeywords)
        {
            if (textToAnalyze.Contains(keyword))
            {
                bestPriority = TicketPriority.urgent;
                matchedPriorityKeyword = keyword;
                if (!keywordsFound.Contains(keyword))
                {
                    keywordsFound.Add(keyword);
                }
                break;
            }
        }

        // If not Urgent, check High
        if (bestPriority == TicketPriority.medium)
        {
            foreach (var keyword in HighKeywords)
            {
                if (textToAnalyze.Contains(keyword))
                {
                    bestPriority = TicketPriority.high;
                    matchedPriorityKeyword = keyword;
                    if (!keywordsFound.Contains(keyword))
                    {
                        keywordsFound.Add(keyword);
                    }
                    break;
                }
            }
        }

        // If not Urgent or High, check Low
        if (bestPriority == TicketPriority.medium)
        {
            foreach (var keyword in LowKeywords)
            {
                if (textToAnalyze.Contains(keyword))
                {
                    bestPriority = TicketPriority.low;
                    matchedPriorityKeyword = keyword;
                    if (!keywordsFound.Contains(keyword))
                    {
                        keywordsFound.Add(keyword);
                    }
                    break;
                }
            }
        }

        // Compute confidence score
        // Default is 0.5. If keywords are matched, raise it based on count
        double confidence = 0.5;
        if (maxCategoryCount > 0)
        {
            confidence = Math.Min(0.5 + (maxCategoryCount * 0.15), 0.95);
        }
        else if (bestPriority != TicketPriority.medium)
        {
            confidence = 0.7; // priority matched, but category defaulted
        }

        // Build reasoning
        var reasoningParts = new List<string>();
        if (bestCategory != TicketCategory.other)
        {
            reasoningParts.Add($"Matched category '{bestCategory}' with {maxCategoryCount} keyword match(es).");
        }
        else
        {
            reasoningParts.Add("No category keywords matched; fallback to 'other'.");
        }

        if (bestPriority != TicketPriority.medium)
        {
            reasoningParts.Add($"Assigned '{bestPriority}' priority due to keyword '{matchedPriorityKeyword}'.");
        }
        else
        {
            reasoningParts.Add("No priority keywords matched; fallback to default 'medium'.");
        }

        var reasoning = string.Join(" ", reasoningParts);

        // Log decision
        _logger.LogInformation(
            "AutoClassification Decision: Category={Category}, Priority={Priority}, Confidence={Confidence}, Keywords=[{Keywords}], Reasoning='{Reasoning}'",
            bestCategory, bestPriority, confidence, string.Join(", ", keywordsFound), reasoning);

        return new AutoClassifyResult
        {
            Category = bestCategory,
            Priority = bestPriority,
            Confidence = confidence,
            Reasoning = reasoning,
            KeywordsFound = keywordsFound
        };
    }

    private static int CountOccurrences(string text, string pattern)
    {
        int count = 0;
        int index = 0;
        while ((index = text.IndexOf(pattern, index, StringComparison.OrdinalIgnoreCase)) != -1)
        {
            count++;
            index += pattern.Length;
        }
        return count;
    }
}
