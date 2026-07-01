import threading
from typing import Optional

from .models import Transaction


class TransactionStore:
    """In-memory, thread-safe transaction store (no database)."""

    def __init__(self) -> None:
        self._items: dict[str, Transaction] = {}
        self._lock = threading.Lock()

    def save(self, transaction: Transaction) -> Transaction:
        with self._lock:
            self._items[transaction.id] = transaction
        return transaction

    def find_all(self) -> list[Transaction]:
        with self._lock:
            return list(self._items.values())

    def find_by_id(self, transaction_id: str) -> Optional[Transaction]:
        with self._lock:
            return self._items.get(transaction_id)

    def clear(self) -> None:
        with self._lock:
            self._items.clear()
