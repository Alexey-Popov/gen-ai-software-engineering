from __future__ import annotations

from uuid import UUID

from app.domain.enums import Category, Priority, Status
from app.domain.models import Ticket


class InMemoryTicketStore:
    def __init__(self) -> None:
        self._data: dict[UUID, Ticket] = {}
        self._order: list[UUID] = []

    def insert(self, ticket: Ticket) -> None:
        self._data[ticket.id] = ticket
        self._order.append(ticket.id)

    def get(self, ticket_id: UUID) -> Ticket | None:
        return self._data.get(ticket_id)

    def list_all(self) -> list[Ticket]:
        return [self._data[i] for i in self._order]

    def update(self, ticket: Ticket) -> None:
        self._data[ticket.id] = ticket

    def delete(self, ticket_id: UUID) -> bool:
        if ticket_id not in self._data:
            return False
        del self._data[ticket_id]
        self._order.remove(ticket_id)
        return True

    def filter(
        self,
        *,
        category: Category | None = None,
        priority: Priority | None = None,
        status: Status | None = None,
    ) -> list[Ticket]:
        results = self.list_all()

        if category is not None:
            results = [t for t in results if t.category == category]

        if priority is not None:
            results = [t for t in results if t.priority == priority]

        if status is not None:
            results = [t for t in results if t.status == status]

        return results


_store = InMemoryTicketStore()


def get_store() -> InMemoryTicketStore:
    return _store
