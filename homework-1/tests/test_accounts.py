from tests.conftest import make_transaction


def test_balance_for_unknown_account_is_empty(client):
    response = client.get("/accounts/ACC-99999/balance")
    assert response.status_code == 200
    assert response.json() == {"accountId": "ACC-99999", "balances": {}}


def test_deposit_credits_to_account_only(client):
    make_transaction(client, tx_type="deposit", from_account="ACC-99999", to_account="ACC-11111", amount=200)

    balance = client.get("/accounts/ACC-11111/balance").json()
    assert balance["balances"] == {"USD": 200.0}

    # the external source side of a deposit is not debited
    source_balance = client.get("/accounts/ACC-99999/balance").json()
    assert source_balance["balances"] == {}


def test_withdrawal_debits_from_account_only(client):
    make_transaction(client, tx_type="withdrawal", from_account="ACC-11111", to_account="ACC-99999", amount=50)

    balance = client.get("/accounts/ACC-11111/balance").json()
    assert balance["balances"] == {"USD": -50.0}


def test_transfer_moves_amount_between_accounts(client):
    make_transaction(client, tx_type="transfer", from_account="ACC-11111", to_account="ACC-22222", amount=75)

    sender = client.get("/accounts/ACC-11111/balance").json()
    receiver = client.get("/accounts/ACC-22222/balance").json()
    assert sender["balances"] == {"USD": -75.0}
    assert receiver["balances"] == {"USD": 75.0}


def test_balance_tracks_separate_currencies(client):
    make_transaction(client, tx_type="deposit", from_account="ACC-99999", to_account="ACC-11111", amount=100, currency="USD")
    make_transaction(client, tx_type="deposit", from_account="ACC-99999", to_account="ACC-11111", amount=50, currency="EUR")

    balance = client.get("/accounts/ACC-11111/balance").json()
    assert balance["balances"] == {"USD": 100.0, "EUR": 50.0}


def test_summary_reports_totals_and_counts(client):
    make_transaction(client, tx_type="deposit", from_account="ACC-99999", to_account="ACC-11111", amount=100)
    make_transaction(client, tx_type="withdrawal", from_account="ACC-11111", to_account="ACC-99999", amount=30)
    make_transaction(client, tx_type="transfer", from_account="ACC-11111", to_account="ACC-22222", amount=10)

    summary = client.get("/accounts/ACC-11111/summary").json()
    assert summary["totalDeposits"] == {"USD": 100.0}
    assert summary["totalWithdrawals"] == {"USD": 30.0}
    assert summary["transactionCount"] == 3
    assert summary["mostRecentTransactionDate"] is not None


def test_summary_for_unknown_account(client):
    summary = client.get("/accounts/ACC-99999/summary").json()
    assert summary["totalDeposits"] == {}
    assert summary["totalWithdrawals"] == {}
    assert summary["transactionCount"] == 0
    assert summary["mostRecentTransactionDate"] is None
