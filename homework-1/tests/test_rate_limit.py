from src.main import app


def test_requests_within_limit_succeed(client):
    app.state.rate_limiter.max_requests = 3

    for _ in range(3):
        response = client.get("/transactions")
        assert response.status_code == 200


def test_requests_beyond_limit_return_429(client):
    app.state.rate_limiter.max_requests = 3

    for _ in range(3):
        client.get("/transactions")

    response = client.get("/transactions")
    assert response.status_code == 429
    assert response.json()["error"] == "Too Many Requests"


def test_limit_is_tracked_per_client_ip(client):
    app.state.rate_limiter.max_requests = 1

    first = client.get("/transactions", headers={"X-Forwarded-For": "1.1.1.1"})
    assert first.status_code == 200

    # TestClient always reports the same client host, so a second call from the
    # "same" IP should be limited even though the header above is spoofed.
    second = client.get("/transactions")
    assert second.status_code == 429
