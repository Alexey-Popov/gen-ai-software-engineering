def deposit(client, to, amount):
    client.post("/transactions", json={
        "fromAccount": "ACC-00000", "toAccount": to, "amount": amount,
        "currency": "USD", "type": "deposit",
    })


def withdraw(client, frm, amount):
    client.post("/transactions", json={
        "fromAccount": frm, "toAccount": "ACC-00000", "amount": amount,
        "currency": "USD", "type": "withdrawal",
    })


def test_balance_existing_account(client):
    deposit(client, "ACC-12345", 200.00)
    withdraw(client, "ACC-12345", 50.00)
    r = client.get("/accounts/ACC-12345/balance")
    assert r.status_code == 200
    assert r.json()["accountId"] == "ACC-12345"
    assert r.json()["balance"] == 150.0


def test_balance_unknown_is_zero(client):
    r = client.get("/accounts/ACC-99999/balance")
    assert r.status_code == 200
    assert r.json()["balance"] == 0


def test_summary_aggregates(client):
    deposit(client, "ACC-12345", 200.00)
    deposit(client, "ACC-12345", 50.00)
    withdraw(client, "ACC-12345", 30.00)
    b = client.get("/accounts/ACC-12345/summary").json()
    assert b["totalDeposits"] == 250.0
    assert b["totalWithdrawals"] == 30.0
    assert b["transactionCount"] == 3
    assert b["mostRecentTransactionDate"] is not None


def test_summary_empty(client):
    b = client.get("/accounts/ACC-99999/summary").json()
    assert b["transactionCount"] == 0
    assert b["mostRecentTransactionDate"] is None


def test_interest_returns_inputs_and_result(client):
    deposit(client, "ACC-12345", 1000.00)
    r = client.get("/accounts/ACC-12345/interest?rate=0.05&days=365")
    assert r.status_code == 200
    b = r.json()
    assert b["accountId"] == "ACC-12345"
    assert b["balance"] == 1000.0
    assert b["rate"] == 0.05
    assert b["days"] == 365
    assert b["interest"] == 50.0


def test_interest_missing_param_400(client):
    r = client.get("/accounts/ACC-12345/interest?days=30")
    assert r.status_code == 400


def test_interest_nonpositive_days_400(client):
    r = client.get("/accounts/ACC-12345/interest?rate=0.05&days=-5")
    assert r.status_code == 400
    assert r.json()["error"] == "Bad request"
