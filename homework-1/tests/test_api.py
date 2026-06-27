from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from src.app import app
from src.models.transaction import transactions_db

client = TestClient(app)

VALID_TX = {
    "fromAccount": "ACC-12345",
    "toAccount": "ACC-67890",
    "amount": 100.50,
    "currency": "USD",
    "type": "transfer",
}


@pytest.fixture(autouse=True)
def clear_store():
    transactions_db.clear()
    yield
    transactions_db.clear()


# --- POST /transactions ---

def test_create_transaction_returns_201():
    r = client.post("/transactions", json=VALID_TX)
    assert r.status_code == 201
    data = r.json()
    assert data["id"]
    assert data["status"] == "completed"
    assert data["amount"] == 100.50
    assert data["currency"] == "USD"


def test_create_transaction_stores_timestamp():
    r = client.post("/transactions", json=VALID_TX)
    assert r.status_code == 201
    assert r.json()["timestamp"]


def test_create_transaction_invalid_amount_zero():
    r = client.post("/transactions", json={**VALID_TX, "amount": 0})
    assert r.status_code == 400
    body = r.json()
    assert body["error"] == "Validation failed"
    assert any(d["field"] == "amount" for d in body["details"])


def test_create_transaction_invalid_amount_negative():
    r = client.post("/transactions", json={**VALID_TX, "amount": -50})
    assert r.status_code == 400
    assert any(d["field"] == "amount" for d in r.json()["details"])


def test_create_transaction_invalid_amount_too_many_decimals():
    r = client.post("/transactions", json={**VALID_TX, "amount": 10.123})
    assert r.status_code == 400
    assert any(d["field"] == "amount" for d in r.json()["details"])


def test_create_transaction_invalid_from_account():
    r = client.post("/transactions", json={**VALID_TX, "fromAccount": "BADFORMAT"})
    assert r.status_code == 400
    assert any(d["field"] == "fromAccount" for d in r.json()["details"])


def test_create_transaction_invalid_to_account():
    r = client.post("/transactions", json={**VALID_TX, "toAccount": "123"})
    assert r.status_code == 400
    assert any(d["field"] == "toAccount" for d in r.json()["details"])


def test_create_transaction_invalid_currency():
    r = client.post("/transactions", json={**VALID_TX, "currency": "XYZ"})
    assert r.status_code == 400
    assert any(d["field"] == "currency" for d in r.json()["details"])


def test_create_transaction_multiple_validation_errors():
    r = client.post("/transactions", json={**VALID_TX, "amount": -1, "currency": "FAKE"})
    assert r.status_code == 400
    assert len(r.json()["details"]) >= 2


def test_create_transaction_valid_currencies():
    for currency in ["EUR", "GBP", "JPY", "CHF"]:
        r = client.post("/transactions", json={**VALID_TX, "currency": currency})
        assert r.status_code == 201, f"Expected 201 for currency {currency}"


# --- GET /transactions ---

def test_list_transactions_empty():
    r = client.get("/transactions")
    assert r.status_code == 200
    assert r.json() == []


def test_list_transactions_returns_all():
    client.post("/transactions", json=VALID_TX)
    client.post("/transactions", json={**VALID_TX, "type": "deposit"})
    r = client.get("/transactions")
    assert len(r.json()) == 2


def test_filter_by_account_id_from():
    client.post("/transactions", json=VALID_TX)
    client.post("/transactions", json={**VALID_TX, "fromAccount": "ACC-AAAAA", "toAccount": "ACC-BBBBB"})
    r = client.get("/transactions?accountId=ACC-12345")
    data = r.json()
    assert len(data) == 1
    assert data[0]["fromAccount"] == "ACC-12345"


def test_filter_by_account_id_to():
    client.post("/transactions", json=VALID_TX)
    r = client.get("/transactions?accountId=ACC-67890")
    data = r.json()
    assert len(data) == 1
    assert data[0]["toAccount"] == "ACC-67890"


def test_filter_by_type_deposit():
    client.post("/transactions", json={**VALID_TX, "type": "deposit"})
    client.post("/transactions", json={**VALID_TX, "type": "withdrawal"})
    r = client.get("/transactions?type=deposit")
    data = r.json()
    assert len(data) == 1
    assert data[0]["type"] == "deposit"


def test_filter_by_type_withdrawal():
    client.post("/transactions", json={**VALID_TX, "type": "withdrawal"})
    client.post("/transactions", json={**VALID_TX, "type": "transfer"})
    r = client.get("/transactions?type=withdrawal")
    assert len(r.json()) == 1


def test_filter_by_date_range_inclusive():
    client.post("/transactions", json=VALID_TX)
    r = client.get("/transactions?from=2000-01-01&to=2099-12-31")
    assert len(r.json()) == 1


def test_filter_by_date_range_excludes_future():
    client.post("/transactions", json=VALID_TX)
    r = client.get("/transactions?from=2099-01-01&to=2099-12-31")
    assert r.json() == []


def test_filter_combined_account_and_type():
    client.post("/transactions", json={**VALID_TX, "type": "deposit"})
    client.post("/transactions", json={**VALID_TX, "type": "withdrawal"})
    r = client.get("/transactions?accountId=ACC-12345&type=deposit")
    assert len(r.json()) == 1
    assert r.json()[0]["type"] == "deposit"


# --- GET /transactions/{id} ---

def test_get_transaction_by_id():
    created = client.post("/transactions", json=VALID_TX).json()
    r = client.get(f"/transactions/{created['id']}")
    assert r.status_code == 200
    assert r.json()["id"] == created["id"]


def test_get_transaction_not_found():
    r = client.get("/transactions/nonexistent-id")
    assert r.status_code == 404
    assert r.json()["detail"] == "Transaction not found"


# --- GET /accounts/{id}/balance ---

def test_get_balance_no_transactions():
    r = client.get("/accounts/ACC-99999/balance")
    assert r.status_code == 200
    data = r.json()
    assert data["balance"] == 0
    assert data["accountId"] == "ACC-99999"


def test_get_balance_inflow_only():
    client.post("/transactions", json={
        "fromAccount": "ACC-EXT01", "toAccount": "ACC-12345",
        "amount": 200.00, "currency": "USD", "type": "deposit",
    })
    r = client.get("/accounts/ACC-12345/balance")
    assert r.json()["balance"] == 200.00


def test_get_balance_inflow_and_outflow():
    client.post("/transactions", json={
        "fromAccount": "ACC-EXT01", "toAccount": "ACC-12345",
        "amount": 200.00, "currency": "USD", "type": "deposit",
    })
    client.post("/transactions", json={
        "fromAccount": "ACC-12345", "toAccount": "ACC-EXT01",
        "amount": 50.00, "currency": "USD", "type": "withdrawal",
    })
    r = client.get("/accounts/ACC-12345/balance")
    assert r.json()["balance"] == 150.00


# --- GET /accounts/{id}/summary ---

def test_get_summary_empty():
    r = client.get("/accounts/ACC-XXXXX/summary")
    assert r.status_code == 200
    data = r.json()
    assert data["transactionCount"] == 0
    assert data["totalDeposits"] == 0
    assert data["totalWithdrawals"] == 0
    assert data["mostRecentDate"] is None


def test_get_summary_with_data():
    client.post("/transactions", json={
        "fromAccount": "ACC-EXT01", "toAccount": "ACC-12345",
        "amount": 100.00, "currency": "USD", "type": "deposit",
    })
    client.post("/transactions", json={
        "fromAccount": "ACC-12345", "toAccount": "ACC-EXT01",
        "amount": 30.00, "currency": "USD", "type": "withdrawal",
    })
    r = client.get("/accounts/ACC-12345/summary")
    data = r.json()
    assert data["transactionCount"] == 2
    assert data["totalDeposits"] == 100.00
    assert data["totalWithdrawals"] == 30.00
    assert data["mostRecentDate"] is not None


def test_get_summary_excludes_transfers_from_totals():
    client.post("/transactions", json={**VALID_TX, "type": "transfer"})
    r = client.get("/accounts/ACC-12345/summary")
    data = r.json()
    assert data["transactionCount"] == 1
    assert data["totalDeposits"] == 0
    assert data["totalWithdrawals"] == 0
