def test_end_to_end_create_balance_summary_consistent(client):
    client.post("/transactions", json={
        "fromAccount": "ACC-000", "toAccount": "ACC-100", "amount": 500.00,
        "currency": "USD", "type": "deposit",
    })
    client.post("/transactions", json={
        "fromAccount": "ACC-100", "toAccount": "ACC-200", "amount": 200.00,
        "currency": "USD", "type": "transfer",
    })

    assert client.get("/accounts/ACC-100/balance").json()["balance"] == 300.0
    assert client.get("/accounts/ACC-200/balance").json()["balance"] == 200.0

    summary = client.get("/accounts/ACC-100/summary").json()
    assert summary["totalDeposits"] == 500.0
    assert summary["totalWithdrawals"] == 0
    assert summary["transactionCount"] == 2
    assert summary["mostRecentTransactionDate"] is not None

    assert len(client.get("/transactions?accountId=ACC-100").json()) == 2
    assert len(client.get("/transactions?type=transfer").json()) == 1
    assert len(client.get("/transactions").json()) == 2
