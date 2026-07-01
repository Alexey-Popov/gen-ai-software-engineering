VALID = {
    "fromAccount": "ACC-12345",
    "toAccount": "ACC-67890",
    "amount": 100.50,
    "currency": "USD",
    "type": "transfer",
}


def test_list_empty(client):
    r = client.get("/transactions")
    assert r.status_code == 200
    assert r.json() == []


def test_create_returns201_with_generated_fields(client):
    r = client.post("/transactions", json=VALID)
    assert r.status_code == 201
    b = r.json()
    assert b["id"]
    assert b["status"] == "completed"
    assert b["type"] == "transfer"
    assert b["amount"] == 100.5
    assert b["timestamp"]
    assert b["fromAccount"] == "ACC-12345"


def test_list_after_create(client):
    client.post("/transactions", json=VALID)
    r = client.get("/transactions")
    assert len(r.json()) == 1


def test_get_by_id_existing(client):
    cid = client.post("/transactions", json=VALID).json()["id"]
    r = client.get(f"/transactions/{cid}")
    assert r.status_code == 200
    assert r.json()["id"] == cid


def test_get_by_id_unknown_returns_404(client):
    r = client.get("/transactions/does-not-exist")
    assert r.status_code == 404
    assert r.json() == {"error": "Transaction not found", "id": "does-not-exist"}
