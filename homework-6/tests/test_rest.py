"""Tests for the REST layer: per-agent FastAPI apps and the in-process client.

These verify the HTTP contract (routing, status codes, request validation) and
the URL helpers — the agents' business logic is covered by their own unit tests.
"""

from __future__ import annotations

import json

import httpx
import pytest
from fastapi.testclient import TestClient

from agents import common, rest
from agents.client import HttpPipelineClient, InProcessPipelineClient


@pytest.fixture
def validator_client():
    client = TestClient(rest.create_app("transaction_validator"))
    yield client
    client.close()


def test_health_endpoints(validator_client):
    live = validator_client.get("/health/live")
    ready = validator_client.get("/health/ready")
    assert live.status_code == 200
    assert ready.status_code == 200
    assert live.json()["agent"] == "transaction_validator"
    assert ready.json()["status"] == "ready"


def test_process_endpoint_validates_and_routes(validator_client, make_message):
    response = validator_client.post("/api/v1/validations", json=make_message())
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["status"] == "validated"
    assert body["source_agent"] == "transaction_validator"
    assert body["target_agent"] == "policy_agent"


def test_process_endpoint_rejects_malformed_body(validator_client):
    # Missing required envelope fields -> FastAPI/Pydantic 422.
    response = validator_client.post("/api/v1/validations", json={"data": {}})
    assert response.status_code == 422


def test_unknown_agent_route_is_404(validator_client, make_message):
    # The validator app does not expose the settlement route.
    response = validator_client.post("/api/v1/settlements", json=make_message())
    assert response.status_code == 404


def test_create_app_unknown_agent_raises():
    with pytest.raises(KeyError):
        rest.create_app("nope")


def test_endpoint_and_summary_urls():
    assert rest.endpoint_url("fraud_detector") == (
        "http://127.0.0.1:8003/api/v1/fraud-assessments"
    )
    assert rest.endpoint_url("policy_agent") == (
        "http://127.0.0.1:8002/api/v1/policy-checks"
    )
    assert rest.endpoint_url("settlement_processor", host="0.0.0.0").startswith(
        "http://0.0.0.0:8005/"
    )
    assert rest.summary_url().endswith("/api/v1/reports/summary")


def test_summary_endpoint_aggregates(make_message):
    client = TestClient(rest.create_app("reporting_agent"))
    try:
        final = common.new_message("settlement_processor", "reporting_agent", {})
        final["data"] = dict(make_message()["data"], status="settled", validated=True)
        response = client.post(rest.SUMMARY_ROUTE, json={"items": [final]})
        assert response.status_code == 200
        summary = response.json()
        assert summary["counts"]["total"] == 1
        assert summary["counts"]["settled"] == 1
    finally:
        client.close()


def test_http_client_posts_to_expected_urls():
    """The HTTP client targets the right per-agent URLs and parses the reply."""
    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(str(request.url))
        return httpx.Response(200, json={"echo": json.loads(request.content)})

    transport = httpx.MockTransport(handler)
    client = HttpPipelineClient(client=httpx.Client(transport=transport))
    try:
        out = client.process("fraud_detector", {"m": 1})
        assert out["echo"] == {"m": 1}
        assert seen[-1] == "http://127.0.0.1:8003/api/v1/fraud-assessments"

        client.summary([{"x": 1}])
        assert seen[-1].endswith("/api/v1/reports/summary")
    finally:
        client.close()


def test_http_client_raises_on_error_status():
    transport = httpx.MockTransport(lambda request: httpx.Response(500))
    client = HttpPipelineClient(client=httpx.Client(transport=transport))
    try:
        with pytest.raises(httpx.HTTPStatusError):
            client.process("transaction_validator", {})
    finally:
        client.close()


def test_orchestrator_app_runs_full_pipeline(tmp_path, sample_transactions):
    app = rest.create_orchestrator_app(
        client_factory=InProcessPipelineClient, shared_root=tmp_path / "shared"
    )
    client = TestClient(app)
    try:
        response = client.post(rest.PIPELINE_RUN_ROUTE, json={"transactions": sample_transactions})
        assert response.status_code == 200
        summary = response.json()
        assert summary["counts"]["total"] == 8
        assert summary["counts"]["settled"] == 4
        assert (tmp_path / "shared" / "results" / "TXN006.json").exists()
    finally:
        client.close()


def test_orchestrator_app_uses_bundled_samples(tmp_path):
    app = rest.create_orchestrator_app(
        client_factory=InProcessPipelineClient, shared_root=tmp_path / "shared"
    )
    client = TestClient(app)
    try:
        response = client.post(rest.PIPELINE_RUN_ROUTE, json={})
        assert response.status_code == 200
        assert response.json()["counts"]["total"] == 8
        assert client.get("/health/ready").json()["agent"] == "orchestrator"
    finally:
        client.close()


def test_orchestrator_app_returns_502_when_agent_unavailable(tmp_path):
    class _BrokenClient:
        def process(self, *args):
            raise RuntimeError("connection refused")

        def summary(self, *args):
            return {}

        def close(self):
            pass

    app = rest.create_orchestrator_app(
        client_factory=lambda: _BrokenClient(), shared_root=tmp_path / "shared"
    )
    client = TestClient(app)
    try:
        response = client.post(
            rest.PIPELINE_RUN_ROUTE, json={"transactions": [{"transaction_id": "T1"}]}
        )
        assert response.status_code == 502
        body = response.json()
        assert body["errorCode"] == "PIPELINE_AGENT_UNAVAILABLE"
        assert body["correlationId"]
    finally:
        client.close()


def test_orchestrator_run_url():
    url = rest.orchestrator_run_url()
    assert ":8000" in url
    assert url.endswith("/api/v1/pipeline/runs")


def test_gateway_submit_one_and_retrieve(tmp_path, valid_txn):
    app = rest.create_orchestrator_app(
        client_factory=InProcessPipelineClient, shared_root=tmp_path / "shared"
    )
    client = TestClient(app)
    try:
        # Submit one transaction -> 201 with a Location header.
        submit = client.post(rest.TRANSACTIONS_ROUTE, json=valid_txn)
        assert submit.status_code == 201
        assert submit.headers["Location"].endswith(f"/api/v1/transactions/{valid_txn['transaction_id']}")
        assert submit.json()["data"]["status"] == "settled"

        # Retrieve it back via GET.
        got = client.get(f"{rest.TRANSACTIONS_ROUTE}/{valid_txn['transaction_id']}")
        assert got.status_code == 200
        assert got.json()["data"]["transaction_id"] == valid_txn["transaction_id"]
    finally:
        client.close()


def test_gateway_get_unknown_transaction_is_404(tmp_path):
    app = rest.create_orchestrator_app(
        client_factory=InProcessPipelineClient, shared_root=tmp_path / "shared"
    )
    client = TestClient(app)
    try:
        got = client.get(f"{rest.TRANSACTIONS_ROUTE}/NOPE")
        assert got.status_code == 404
        assert got.json()["errorCode"] == "TRANSACTION_NOT_FOUND"
    finally:
        client.close()


def test_gateway_summary_retrieval(tmp_path, sample_transactions):
    app = rest.create_orchestrator_app(
        client_factory=InProcessPipelineClient, shared_root=tmp_path / "shared"
    )
    client = TestClient(app)
    try:
        # Before any run -> 404.
        assert client.get(rest.PIPELINE_SUMMARY_ROUTE).status_code == 404
        # Run, then the summary is retrievable.
        client.post(rest.PIPELINE_RUN_ROUTE, json={"transactions": sample_transactions})
        summary = client.get(rest.PIPELINE_SUMMARY_ROUTE)
        assert summary.status_code == 200
        assert summary.json()["counts"]["total"] == 8
    finally:
        client.close()


def test_gateway_submit_returns_502_on_agent_failure(tmp_path, valid_txn):
    class _BrokenClient:
        def process(self, *args):
            raise RuntimeError("connection refused")

        def summary(self, *args):
            return {}

        def close(self):
            pass

    app = rest.create_orchestrator_app(
        client_factory=lambda: _BrokenClient(), shared_root=tmp_path / "shared"
    )
    client = TestClient(app)
    try:
        submit = client.post(rest.TRANSACTIONS_ROUTE, json=valid_txn)
        assert submit.status_code == 502
        assert submit.json()["errorCode"] == "PIPELINE_AGENT_UNAVAILABLE"
    finally:
        client.close()


def test_inprocess_client_runs_one_transaction(valid_txn):
    client = InProcessPipelineClient()
    try:
        message = common.new_message("integrator", "transaction_validator", valid_txn)
        # Walk the chain by following target_agent, exactly like the integrator.
        current = "transaction_validator"
        while current != "reporting_agent":
            message = client.process(current, message)
            current = message["target_agent"]
        final = client.process("reporting_agent", message)
        assert final["data"]["status"] == "settled"

        summary = client.summary([final])
        assert summary["counts"]["settled"] == 1
    finally:
        client.close()
