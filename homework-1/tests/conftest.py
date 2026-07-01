import pytest
from fastapi.testclient import TestClient

from src.main import app
from src.storage import store


@pytest.fixture
def client():
    store.reset()
    app.state.rate_limiter.reset()
    app.state.rate_limiter.max_requests = 100
    with TestClient(app) as test_client:
        yield test_client
    store.reset()


def make_transaction(
    client,
    from_account="ACC-11111",
    to_account="ACC-22222",
    amount=100.0,
    currency="USD",
    tx_type="transfer",
):
    return client.post(
        "/transactions",
        json={
            "fromAccount": from_account,
            "toAccount": to_account,
            "amount": amount,
            "currency": currency,
            "type": tx_type,
        },
    )
