from fastapi.testclient import TestClient

from app.main import create_app


def test_within_limit_succeeds():
    c = TestClient(create_app(rate_limit=3))
    for _ in range(3):
        assert c.get("/transactions").status_code == 200


def test_over_limit_returns_429():
    c = TestClient(create_app(rate_limit=3))
    for _ in range(3):
        assert c.get("/transactions").status_code == 200
    r = c.get("/transactions")
    assert r.status_code == 429
    assert r.json()["error"] == "Too Many Requests"
