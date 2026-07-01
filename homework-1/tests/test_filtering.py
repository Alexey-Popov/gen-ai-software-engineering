from datetime import date, timedelta

from tests.conftest import make_transaction


def test_filter_by_account_id(client):
    make_transaction(client, from_account="ACC-11111", to_account="ACC-22222")
    make_transaction(client, from_account="ACC-33333", to_account="ACC-44444")

    response = client.get("/transactions", params={"accountId": "ACC-11111"})
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["fromAccount"] == "ACC-11111"


def test_filter_by_type(client):
    make_transaction(client, tx_type="deposit", from_account="ACC-11111", to_account="ACC-11111")
    make_transaction(client, tx_type="withdrawal", from_account="ACC-11111", to_account="ACC-11111")
    make_transaction(client, tx_type="transfer")

    response = client.get("/transactions", params={"type": "deposit"})
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["type"] == "deposit"


def test_filter_by_date_range(client):
    make_transaction(client)

    today = date.today()
    yesterday = (today - timedelta(days=1)).isoformat()
    tomorrow = (today + timedelta(days=1)).isoformat()

    in_range = client.get("/transactions", params={"from": yesterday, "to": tomorrow})
    assert len(in_range.json()) == 1

    out_of_range = client.get("/transactions", params={"from": tomorrow, "to": tomorrow})
    assert len(out_of_range.json()) == 0


def test_combine_multiple_filters(client):
    make_transaction(client, tx_type="deposit", from_account="ACC-11111", to_account="ACC-11111")
    make_transaction(client, tx_type="transfer", from_account="ACC-11111", to_account="ACC-22222")

    today = date.today().isoformat()
    response = client.get(
        "/transactions",
        params={"accountId": "ACC-11111", "type": "transfer", "from": today, "to": today},
    )
    results = response.json()
    assert len(results) == 1
    assert results[0]["type"] == "transfer"
