from tests.conftest import make_transaction


def test_create_transaction_returns_201_and_full_record(client):
    response = make_transaction(client)
    assert response.status_code == 201

    body = response.json()
    assert body["fromAccount"] == "ACC-11111"
    assert body["toAccount"] == "ACC-22222"
    assert body["amount"] == 100.0
    assert body["currency"] == "USD"
    assert body["type"] == "transfer"
    assert body["status"] == "completed"
    assert "id" in body and body["id"]
    assert "timestamp" in body and body["timestamp"]


def test_list_transactions_returns_created_transactions(client):
    make_transaction(client)
    make_transaction(client, amount=50.0)

    response = client.get("/transactions")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_get_transaction_by_id(client):
    created = make_transaction(client).json()

    response = client.get(f"/transactions/{created['id']}")
    assert response.status_code == 200
    assert response.json()["id"] == created["id"]


def test_get_transaction_not_found_returns_404(client):
    response = client.get("/transactions/does-not-exist")
    assert response.status_code == 404
    assert response.json()["error"] == "Transaction not found"


def test_currency_is_normalized_to_uppercase(client):
    response = make_transaction(client, currency="usd")
    assert response.status_code == 201
    assert response.json()["currency"] == "USD"
