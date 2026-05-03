"""Unit tests for the rule-based classifier (Task 2).

Contract source: docs/task2-design.md

All 10 tests call classify(...) which currently raises NotImplementedError —
that is the expected RED state. No xfail markers; every test must fail until
the implementation is written.

Priority keyword table (§5.1):
    urgent  : "can't access", "critical", "production down", "security"
    high    : "important", "blocking", "asap"
    low     : "minor", "cosmetic", "suggestion"
    medium  : (default — no keywords)

Category keyword table (§5.2):
    account_access   : "login", "password", "2fa", "account", "access", "sign in", "locked out"
    technical_issue  : "bug", "error", "crash", "broken", "not working", "exception", "500"
    billing_question : "payment", "invoice", "refund", "charge", "billing", "subscription"
    feature_request  : "feature", "enhancement", "request", "would like", "suggestion", "add"
    bug_report       : "defect", "reproduce", "steps to reproduce", "regression", "expected behavior"
    other            : (default — no keywords)

Confidence formula (§1.5):
    confidence = round(min(1.0, len(keywords_found) / 5.0), 2)
"""
from __future__ import annotations

import uuid

import pytest

from app.domain.enums import Category, Priority
from app.domain.models import ClassificationResult
from app.services.classifier import classify


# ---------------------------------------------------------------------------
# 1. Urgent priority via subject keyword
# ---------------------------------------------------------------------------

def test_classify_urgent_keyword():
    """Subject containing 'critical' → priority == Priority.urgent.

    Ref: task2-design.md §1.3, §5.1 — "critical" is an urgent keyword.
    """
    tid = uuid.uuid4()
    result = classify(tid, "Critical system failure", "The system is completely unresponsive.")

    assert isinstance(result, ClassificationResult)
    assert result.priority == Priority.urgent


# ---------------------------------------------------------------------------
# 2. High priority via description keyword
# ---------------------------------------------------------------------------

def test_classify_high_keyword():
    """Description containing 'blocking' → priority == Priority.high.

    Ref: task2-design.md §1.3, §5.1 — "blocking" is a high-priority keyword.
    Tested via description, not subject, to verify concatenated search string.
    """
    tid = uuid.uuid4()
    result = classify(tid, "Release pipeline issue", "This is blocking our entire team's deployment.")

    assert isinstance(result, ClassificationResult)
    assert result.priority == Priority.high


# ---------------------------------------------------------------------------
# 3. Low priority via subject keyword
# ---------------------------------------------------------------------------

def test_classify_low_keyword():
    """Subject containing 'minor issue' → priority == Priority.low.

    Ref: task2-design.md §1.3, §5.1 — "minor" is a low-priority keyword.
    'minor issue' contains the substring 'minor' so it matches.
    """
    tid = uuid.uuid4()
    result = classify(tid, "Minor issue with button alignment", "The submit button is slightly off-center on mobile.")

    assert isinstance(result, ClassificationResult)
    assert result.priority == Priority.low


# ---------------------------------------------------------------------------
# 4. Medium priority when no priority keyword matches
# ---------------------------------------------------------------------------

def test_classify_medium_default():
    """No priority keywords in subject or description → priority == Priority.medium.

    Ref: task2-design.md §1.3 — medium is the fallback when no priority keyword matches.
    """
    tid = uuid.uuid4()
    result = classify(
        tid,
        "How do I export my data?",
        "I would like to know the steps to export all my account data.",
    )

    assert isinstance(result, ClassificationResult)
    assert result.priority == Priority.medium


# ---------------------------------------------------------------------------
# 5. Account access category via 'login' keyword
# ---------------------------------------------------------------------------

def test_classify_account_access_category():
    """Text containing 'login' → category == Category.account_access.

    Ref: task2-design.md §1.4, §5.2 — "login" maps to account_access (first in declaration order).
    """
    tid = uuid.uuid4()
    result = classify(tid, "Cannot login to my account", "I keep getting an error when I try to login.")

    assert isinstance(result, ClassificationResult)
    assert result.category == Category.account_access


# ---------------------------------------------------------------------------
# 6. Billing question category via 'invoice' keyword
# ---------------------------------------------------------------------------

def test_classify_billing_category():
    """Text containing 'invoice' → category == Category.billing_question.

    Ref: task2-design.md §1.4, §5.2 — "invoice" maps to billing_question.
    Requires no account_access keywords present so billing_question wins.
    """
    tid = uuid.uuid4()
    result = classify(
        tid,
        "Invoice not received",
        "I have not received my invoice for the last billing cycle.",
    )

    assert isinstance(result, ClassificationResult)
    assert result.category == Category.billing_question


# ---------------------------------------------------------------------------
# 7. Empty-ish text → all defaults
# ---------------------------------------------------------------------------

def test_classify_no_keywords_defaults():
    """Subject and description with no matching keywords →
    category == Category.other, priority == Priority.medium,
    confidence == 0.0, keywords_found == [].

    Ref: task2-design.md §6 edge case #1.
    """
    tid = uuid.UUID(int=0)
    result = classify(tid, "Hello", "I just wanted to say hello there.")

    assert isinstance(result, ClassificationResult)
    assert result.category == Category.other
    assert result.priority == Priority.medium
    assert result.confidence == 0.0
    assert result.keywords_found == []


# ---------------------------------------------------------------------------
# 8. Confidence formula: 5 distinct hits → 1.0; 1 hit → 0.20
# ---------------------------------------------------------------------------

def test_classify_confidence_formula():
    """Confidence = round(min(1.0, distinct_keyword_hits / 5.0), 2).

    Five distinct hits must produce 1.0; one distinct hit must produce 0.20.

    Ref: task2-design.md §1.5 — confidence formula.
    §5.1 priority keywords, §5.2 category keywords.
    """
    tid = uuid.uuid4()

    # Five distinct keyword hits:
    # priority: "critical" (urgent) → 1 priority kw
    # category account_access: "login", "password", "account" → 3 category kws
    # category technical_issue: "error" → 1 more category kw
    # Total unique = 5 → confidence 1.0
    result_five = classify(
        tid,
        "Critical login error with password and account",
        "There is an error in the password reset for my account.",
    )
    assert result_five.confidence == 1.0

    # One distinct hit: only "billing" found → confidence 0.20
    tid2 = uuid.uuid4()
    result_one = classify(
        tid2,
        "Billing inquiry",
        "I have a general question that is unrelated to anything else.",
    )
    assert result_one.confidence == 0.20


# ---------------------------------------------------------------------------
# 9. Precedence: urgent beats high when both present
# ---------------------------------------------------------------------------

def test_classify_precedence_urgent_over_high():
    """Text containing both 'important' (high) and 'critical' (urgent) →
    priority == Priority.urgent; urgent beats high per precedence table.

    Ref: task2-design.md §1.3 — urgent > high > low > medium precedence.
    """
    tid = uuid.uuid4()
    result = classify(
        tid,
        "Important: critical database issue",
        "This is an important alert. The situation is critical.",
    )

    assert isinstance(result, ClassificationResult)
    assert result.priority == Priority.urgent


# ---------------------------------------------------------------------------
# 10. keywords_found list contains all matched keywords across priority + category
# ---------------------------------------------------------------------------

def test_classify_keywords_found_list():
    """Text containing 'security' (urgent priority) and 'login' (account_access category) →
    both keywords appear in result.keywords_found, and ticket_id is correctly set.

    Ref: task2-design.md §1.5, §1.7 — keywords_found is the union of all matched
    priority keywords and all matched category keywords, deduplicated, order-preserving
    (priority keywords first, then category keywords in declaration order).
    """
    tid = uuid.uuid4()
    result = classify(
        tid,
        "Security alert: login attempt blocked",
        "We detected an unusual login attempt on your account.",
    )

    assert isinstance(result, ClassificationResult)
    assert result.ticket_id == tid
    assert "security" in result.keywords_found
    assert "login" in result.keywords_found


# ---------------------------------------------------------------------------
# 11. Edge case #4: multiple priorities match → highest precedence wins,
#     all matched priority keywords appear in keywords_found
# ---------------------------------------------------------------------------

def test_classify_multiple_priorities_all_in_keywords_found():
    """Edge case #4: multiple priorities match → highest wins, all matched keywords in list.

    "important" maps to high; "critical" maps to urgent; "blocking" maps to high.
    urgent > high, so priority == urgent.
    All three matched keywords must appear in keywords_found.

    Ref: task2-design.md §6 edge case #4, §1.3 precedence, §1.7 keywords_found.
    """
    from uuid import uuid4
    result = classify(uuid4(), "Important and critical issue", "This is blocking production down")
    assert result.priority == Priority.urgent  # urgent beats high
    assert "critical" in result.keywords_found
    assert "important" in result.keywords_found  # high keyword also present
    assert "blocking" in result.keywords_found


# ---------------------------------------------------------------------------
# 12. Edge case #5: multiple categories match → first-listed wins,
#     all matched category keywords appear in keywords_found
# ---------------------------------------------------------------------------

def test_classify_multiple_categories_all_keywords_in_found():
    """Edge case #5: multiple categories match → first wins, all category keywords in keywords_found.

    "login" matches account_access (first in declaration order);
    "invoice" matches billing_question (later).
    account_access wins; both keywords must still appear in keywords_found.

    Ref: task2-design.md §6 edge case #5, §1.4, §1.5, §1.7.
    """
    from uuid import uuid4
    # "login" matches account_access (first), "invoice" matches billing_question (later)
    result = classify(uuid4(), "Login and invoice issue", "Cannot access account, need payment refund")
    assert result.category == Category.account_access  # first-match wins
    assert "login" in result.keywords_found
    assert "invoice" in result.keywords_found  # from billing_question — still in keywords_found


# ---------------------------------------------------------------------------
# 13. Edge case #6: keyword shared by priority and category tables →
#     counted exactly once in keywords_found
# ---------------------------------------------------------------------------

def test_classify_cross_table_keyword_counted_once():
    """Edge case #6: 'suggestion' in both low-priority and feature_request → counted once.

    keywords_found is deduplicated via dict.fromkeys; 'suggestion' must appear
    exactly once regardless of how many tables it matches.

    Ref: task2-design.md §6 edge case #6, §1.7, §5.3.
    """
    from uuid import uuid4
    result = classify(uuid4(), "A suggestion", "I have a minor suggestion for improvement")
    assert result.keywords_found.count("suggestion") == 1


# ---------------------------------------------------------------------------
# 14. Edge case #7: mixed-case input is lowercased before matching
# ---------------------------------------------------------------------------

def test_classify_mixed_case_input():
    """Edge case #7: uppercase input is lowercased before matching.

    "CRITICAL" must match "critical" (urgent); "PRODUCTION DOWN" must match
    "production down" (urgent); "access" inside text matches account_access category.

    Ref: task2-design.md §6 edge case #7, §1.2.
    """
    from uuid import uuid4
    result = classify(uuid4(), "CRITICAL BUG", "PRODUCTION DOWN cannot access system")
    assert result.priority == Priority.urgent
    assert result.category == Category.account_access  # "access" matches


# ---------------------------------------------------------------------------
# 15. MINOR Finding 4: ClassificationLog.entries() with no ticket_id filter
#     returns all recorded entries
# ---------------------------------------------------------------------------

def test_classification_log_entries_no_filter():
    """MINOR Finding 4: entries() with no ticket_id returns all entries.

    Records two distinct ClassificationResults into a fresh log and verifies
    that entries() (no argument) returns both of them.

    Ref: task2-design.md §4, classification_log.py ClassificationLog.entries().
    """
    from uuid import uuid4
    from app.services.classification_log import ClassificationLog
    log = ClassificationLog()
    r1 = classify(uuid4(), "Critical login failure", "Cannot access account")
    r2 = classify(uuid4(), "Invoice question", "Payment billing refund")
    log.record(r1)
    log.record(r2)
    all_entries = log.entries()  # no ticket_id filter
    assert len(all_entries) == 2
