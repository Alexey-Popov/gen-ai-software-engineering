def test_health_returns_up(client):
    r = client.get("/actuator/health")
    assert r.status_code == 200
    assert r.json() == {"status": "UP"}


def test_openapi_spec_has_title(client):
    r = client.get("/openapi.json")
    assert r.status_code == 200
    assert r.json()["info"]["title"] == "Banking Transactions API (FastAPI)"


def test_swagger_docs_served(client):
    r = client.get("/docs")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]
