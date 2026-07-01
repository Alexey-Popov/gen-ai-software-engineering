from datetime import datetime
from decimal import Decimal

from app.models import Transaction, TransactionStatus, TransactionType


def _seed(store, tid, frm, to):
    store.save(Transaction(
        id=tid, fromAccount=frm, toAccount=to, amount=Decimal("10.00"),
        currency="USD", type=TransactionType.transfer,
        timestamp=datetime.fromisoformat("2024-01-01T10:00:00+00:00"),
        status=TransactionStatus.completed,
    ))


def test_export_returns_csv_with_attachment(client):
    r = client.get("/transactions/export?format=csv")
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    assert "attachment" in r.headers["content-disposition"]


def test_export_body_has_header_and_rows(client):
    s = client.app.state.store
    _seed(s, "a", "ACC-1", "ACC-2")
    _seed(s, "b", "ACC-3", "ACC-4")
    text = client.get("/transactions/export?format=csv").text
    lines = [ln for ln in text.strip().split("\n") if ln.strip()]
    assert len(lines) == 3
    assert lines[0].strip() == "id,fromAccount,toAccount,amount,currency,type,timestamp,status"


def test_export_unsupported_format_400(client):
    r = client.get("/transactions/export?format=xml")
    assert r.status_code == 400
