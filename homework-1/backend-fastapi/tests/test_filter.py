from datetime import datetime
from decimal import Decimal

from app.models import Transaction, TransactionStatus, TransactionType


def _seed(store, tid, frm, to, typ, iso):
    store.save(Transaction(
        id=tid, fromAccount=frm, toAccount=to, amount=Decimal("10.00"),
        currency="USD", type=typ, timestamp=datetime.fromisoformat(iso),
        status=TransactionStatus.completed,
    ))


def _seeded(client):
    s = client.app.state.store
    _seed(s, "t1", "ACC-A", "ACC-B", TransactionType.transfer, "2024-01-10T12:00:00+00:00")
    _seed(s, "t2", "ACC-C", "ACC-A", TransactionType.deposit, "2024-01-20T12:00:00+00:00")
    _seed(s, "t3", "ACC-A", "ACC-D", TransactionType.withdrawal, "2024-02-15T12:00:00+00:00")
    _seed(s, "t4", "ACC-X", "ACC-Y", TransactionType.transfer, "2024-01-25T12:00:00+00:00")


def test_filter_by_account_matches_from_or_to(client):
    _seeded(client)
    assert len(client.get("/transactions?accountId=ACC-A").json()) == 3


def test_filter_by_type(client):
    _seeded(client)
    assert len(client.get("/transactions?type=transfer").json()) == 2


def test_filter_by_date_range_inclusive(client):
    _seeded(client)
    assert len(client.get("/transactions?from=2024-01-10&to=2024-01-25").json()) == 3


def test_filter_combined_and(client):
    _seeded(client)
    got = client.get("/transactions?accountId=ACC-A&type=transfer").json()
    assert len(got) == 1
    assert got[0]["fromAccount"] == "ACC-A"


def test_filter_no_matches(client):
    _seeded(client)
    assert client.get("/transactions?accountId=ACC-NONE").json() == []
