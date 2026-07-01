def base(**overrides):
    body = {
        "fromAccount": "ACC-12345",
        "toAccount": "ACC-67890",
        "amount": 100.50,
        "currency": "USD",
        "type": "transfer",
    }
    body.update(overrides)
    return body


def fields(r):
    return {d["field"] for d in r.json()["details"]}


def test_negative_amount(client):
    r = client.post("/transactions", json=base(amount=-5))
    assert r.status_code == 400
    assert r.json()["error"] == "Validation failed"
    assert "amount" in fields(r)


def test_too_many_decimals(client):
    r = client.post("/transactions", json=base(amount=100.555))
    assert r.status_code == 400
    assert "amount" in fields(r)


def test_bad_account_format(client):
    r = client.post("/transactions", json=base(fromAccount="12345"))
    assert r.status_code == 400
    assert "fromAccount" in fields(r)


def test_invalid_currency(client):
    r = client.post("/transactions", json=base(currency="XYZ"))
    assert r.status_code == 400
    assert "currency" in fields(r)


def test_invalid_type(client):
    r = client.post("/transactions", json=base(type="gift"))
    assert r.status_code == 400
    assert "type" in fields(r)


def test_multiple_errors(client):
    r = client.post("/transactions", json=base(amount=-5, currency="XYZ"))
    assert r.status_code == 400
    assert {"amount", "currency"} <= fields(r)
