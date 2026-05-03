"""
Rule-based keyword classifier (Task 2).

Pure function — no I/O, no side effects, deterministic.
"""
from __future__ import annotations

from uuid import UUID

from app.domain.enums import Category, Priority
from app.domain.models import ClassificationResult

PRIORITY_KEYWORDS: dict[Priority, list[str]] = {
    Priority.urgent: ["can't access", "critical", "production down", "security"],
    Priority.high:   ["important", "blocking", "asap"],
    Priority.low:    ["minor", "cosmetic", "suggestion"],
}

CATEGORY_KEYWORDS: dict[Category, list[str]] = {
    Category.account_access:   ["login", "password", "2fa", "account", "access", "sign in", "locked out"],
    Category.technical_issue:  ["bug", "error", "crash", "broken", "not working", "exception", "500"],
    Category.billing_question: ["payment", "invoice", "refund", "charge", "billing", "subscription"],
    Category.feature_request:  ["feature", "enhancement", "request", "would like", "suggestion", "add"],
    Category.bug_report:       ["defect", "reproduce", "steps to reproduce", "regression", "expected behavior"],
}


def classify(ticket_id: UUID, subject: str, description: str) -> ClassificationResult:
    """Classify a ticket by subject and description.

    Returns a ClassificationResult with predicted category, priority, confidence
    score, reasoning text, and list of matched keywords.

    Never raises on empty strings; returns defaults (category=other, priority=medium,
    confidence=0.0, keywords_found=[]).
    """
    text = (subject + " " + description).lower()

    # Priority: collect matched keywords per level, then apply precedence
    priority_hits: dict[Priority, list[str]] = {}
    for priority, kws in PRIORITY_KEYWORDS.items():
        matched = [kw for kw in kws if kw in text]
        if matched:
            priority_hits[priority] = matched

    if Priority.urgent in priority_hits:
        resolved_priority = Priority.urgent
    elif Priority.high in priority_hits:
        resolved_priority = Priority.high
    elif Priority.low in priority_hits:
        resolved_priority = Priority.low
    else:
        resolved_priority = Priority.medium

    # Category: first-match in declaration order
    resolved_category = Category.other
    category_hits: dict[Category, list[str]] = {}
    for category, kws in CATEGORY_KEYWORDS.items():
        matched = [kw for kw in kws if kw in text]
        if matched:
            category_hits[category] = matched
            if resolved_category == Category.other:
                resolved_category = category

    # keywords_found: priority hits first (table order), then all category hits (table order), deduplicated
    all_kws: list[str] = []
    for priority in [Priority.urgent, Priority.high, Priority.low]:
        all_kws.extend(priority_hits.get(priority, []))
    for category in CATEGORY_KEYWORDS:
        all_kws.extend(category_hits.get(category, []))
    keywords_found = list(dict.fromkeys(all_kws))  # dedup, preserve order

    # Confidence
    hits = len(keywords_found)
    confidence = round(min(1.0, hits / 5.0), 2)

    # Reasoning
    # p_kws/c_kws list raw per-table matches (may duplicate cross-table);
    # keywords_found is the authoritative deduplicated list.
    p_kws = [kw for p in [Priority.urgent, Priority.high, Priority.low] for kw in priority_hits.get(p, [])]
    c_kws = [kw for cat in CATEGORY_KEYWORDS for kw in category_hits.get(cat, [])]
    reasoning = f"Matched priority keywords: {p_kws!r}. Matched category keywords: {c_kws!r}."

    return ClassificationResult(
        ticket_id=ticket_id,
        category=resolved_category,
        priority=resolved_priority,
        confidence=confidence,
        reasoning=reasoning,
        keywords_found=keywords_found,
    )
