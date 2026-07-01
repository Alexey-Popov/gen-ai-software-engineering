import pytest

from tests.conftest import make_transaction


@pytest.mark.parametrize("amount", [-10, 0, "not-a-number"])
def test_invalid_amount_rejected(client, amount):
    response = make_transaction(client, amount=amount)
    assert response.status_code == 400
    body = response.json()
    assert body["error"] == "Validation failed"
    assert any(d["field"] == "amount" for d in body["details"])


def test_amount_with_more_than_two_decimals_rejected(client):
    response = make_transaction(client, amount=10.123)
    assert response.status_code == 400
    assert any(d["field"] == "amount" for d in response.json()["details"])


def test_amount_with_two_decimals_accepted(client):
    response = make_transaction(client, amount=10.55)
    assert response.status_code == 201


@pytest.mark.parametrize("account", ["12345", "ACC-123", "ACC-12345X", "acc-1234"])
def test_invalid_account_format_rejected(client, account):
    response = make_transaction(client, from_account=account)
    assert response.status_code == 400
    assert any(d["field"] == "fromAccount" for d in response.json()["details"])


def test_invalid_currency_rejected(client):
    response = make_transaction(client, currency="XYZ")
    assert response.status_code == 400
    body = response.json()
    assert any(d["field"] == "currency" for d in body["details"])


def test_invalid_type_rejected(client):
    response = make_transaction(client, tx_type="invalid-type")
    assert response.status_code == 400
    assert any(d["field"] == "type" for d in response.json()["details"])


def test_missing_fields_rejected(client):
    response = client.post("/transactions", json={})
    assert response.status_code == 400
    body = response.json()
    fields = {d["field"] for d in body["details"]}
    assert {"fromAccount", "toAccount", "amount", "currency", "type"} == fields


def test_multiple_validation_errors_reported_together(client):
    response = make_transaction(client, amount=-5, currency="XYZ")
    assert response.status_code == 400
    fields = {d["field"] for d in response.json()["details"]}
    assert {"amount", "currency"}.issubset(fields)
