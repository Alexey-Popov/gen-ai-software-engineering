"""
Append-only in-memory log of classification decisions (Task 2 stub).

The log is a singleton backed by a plain list. In Task 2, the classifier will call
`get_log().record(result)` after each classification. Tests can inject a fresh
ClassificationLog if isolation is needed (no DI wiring required for Phase 1).
"""
from __future__ import annotations

from uuid import UUID

from app.domain.models import ClassificationResult


class ClassificationLog:
    def __init__(self) -> None:
        self._entries: list[ClassificationResult] = []

    def record(self, result: ClassificationResult) -> None:
        """Append a classification result to the log."""
        self._entries.append(result)

    def entries(self, ticket_id: UUID | None = None) -> list[ClassificationResult]:
        """Return all log entries, optionally filtered by ticket_id."""
        if ticket_id is None:
            return list(self._entries)
        return [e for e in self._entries if e.ticket_id == ticket_id]


_log = ClassificationLog()


def get_log() -> ClassificationLog:
    return _log
