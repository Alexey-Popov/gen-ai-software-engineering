import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.classification_log import ClassificationLog, get_log
from app.services.store import InMemoryTicketStore, get_store


@pytest.fixture
def fresh_store() -> InMemoryTicketStore:
    return InMemoryTicketStore()


@pytest.fixture
def fresh_log() -> ClassificationLog:
    return ClassificationLog()


@pytest.fixture
def client(fresh_store: InMemoryTicketStore, fresh_log: ClassificationLog) -> TestClient:
    app.dependency_overrides[get_store] = lambda: fresh_store
    app.dependency_overrides[get_log] = lambda: fresh_log
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
