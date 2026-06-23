"""REST layer for the multi-agent banking pipeline.

Each of the five agents is exposed as its own small FastAPI service. The
integrator (:mod:`integrator`) drives a transaction through the chain by
calling these endpoints over HTTP instead of moving JSON files around a shared
directory.

Per-agent contract (all versioned under ``/api/v1``):

    POST <route>            process one pipeline message, return the next one
    GET  /health/live       liveness  — the process is up
    GET  /health/ready      readiness — the service can handle traffic

The reporting service additionally exposes::

    POST /api/v1/reports/summary   aggregate a batch of final messages

Run a single service directly::

    python -m agents.rest fraud_detector          # serves on :8002

or launch the whole fleet with :mod:`run_services`.
"""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any, Callable

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from agents import (
    common,
    compliance_checker,
    fraud_detector,
    orchestrator,
    policy_agent,
    reporting_agent,
    settlement_processor,
    transaction_validator,
)

#: Default host the services bind to / the client dials.
DEFAULT_HOST = "127.0.0.1"

#: The master agent (orchestrator) gets its own port and gateway endpoints.
ORCHESTRATOR_PORT = 8000
PIPELINE_RUN_ROUTE = "/api/v1/pipeline/runs"
PIPELINE_SUMMARY_ROUTE = "/api/v1/pipeline/summary"
TRANSACTIONS_ROUTE = "/api/v1/transactions"

#: Bundled sample transactions, used when a run request omits a body.
SAMPLE_TRANSACTIONS = Path(__file__).resolve().parent.parent / "sample-transactions.json"

#: agent name -> (module, REST route, TCP port). Order matches the pipeline.
SERVICES: dict[str, tuple[Any, str, int]] = {
    "transaction_validator": (transaction_validator, "/api/v1/validations", 8001),
    "policy_agent": (policy_agent, "/api/v1/policy-checks", 8002),
    "fraud_detector": (fraud_detector, "/api/v1/fraud-assessments", 8003),
    "compliance_checker": (compliance_checker, "/api/v1/compliance-checks", 8004),
    "settlement_processor": (settlement_processor, "/api/v1/settlements", 8005),
    "reporting_agent": (reporting_agent, "/api/v1/reports", 8006),
}

SUMMARY_ROUTE = "/api/v1/reports/summary"


# --- Wire contracts (DTOs) ---------------------------------------------------

class Message(BaseModel):
    """The pipeline message envelope as it travels over HTTP.

    ``data`` is intentionally an open mapping: each agent enriches it with its
    own fields (risk score, compliance flags, settlement amounts, ...), so the
    envelope stays stable while the payload grows along the chain.
    """

    model_config = ConfigDict(extra="forbid")

    message_id: str
    timestamp: str
    source_agent: str
    target_agent: str
    message_type: str = "transaction"
    data: dict[str, Any]


class SummaryRequest(BaseModel):
    """Batch of final messages handed to the reporting summary endpoint."""

    items: list[Message] = Field(default_factory=list)


class PipelineRunRequest(BaseModel):
    """Body for a master-agent pipeline run.

    ``transactions`` is optional: when omitted, the orchestrator runs the
    bundled ``sample-transactions.json``.
    """

    transactions: list[dict[str, Any]] | None = None


# --- App factory -------------------------------------------------------------

def create_app(agent_name: str) -> FastAPI:
    """Build the FastAPI app for a single agent.

    Args:
        agent_name: a key of :data:`SERVICES`.

    Raises:
        KeyError: if ``agent_name`` is not a known agent.
    """
    module, route, _port = SERVICES[agent_name]
    app = FastAPI(title=f"{agent_name} service", version="1.0.0")

    @app.get("/health/live")
    def live() -> dict[str, str]:
        return {"status": "alive", "agent": agent_name}

    @app.get("/health/ready")
    def ready() -> dict[str, str]:
        return {"status": "ready", "agent": agent_name}

    @app.post(route)
    def process(message: Message) -> dict[str, Any]:
        """Run the agent's pure ``process_message`` over the request body."""
        return module.process_message(message.model_dump())

    if agent_name == "reporting_agent":

        @app.post(SUMMARY_ROUTE)
        def summary(request: SummaryRequest) -> dict[str, Any]:
            finals = [item.model_dump() for item in request.items]
            return reporting_agent.build_summary(finals)

    return app


def endpoint_url(agent_name: str, host: str = DEFAULT_HOST) -> str:
    """Return the full ``process`` URL for ``agent_name`` on ``host``."""
    _module, route, port = SERVICES[agent_name]
    return f"http://{host}:{port}{route}"


def summary_url(host: str = DEFAULT_HOST) -> str:
    """Return the reporting summary URL on ``host``."""
    port = SERVICES["reporting_agent"][2]
    return f"http://{host}:{port}{SUMMARY_ROUTE}"


# --- Master agent (orchestrator) service -------------------------------------

def create_orchestrator_app(
    client_factory: Callable[[], Any] | None = None,
    shared_root: Path | None = None,
) -> FastAPI:
    """Build the master-agent (orchestrator) service.

    Args:
        client_factory: returns a fresh pipeline client used to call the worker
            agents. Defaults to a real :class:`agents.client.HttpPipelineClient`.
        shared_root: where results are persisted. Defaults to ``./shared``.
    """
    shared = Path(shared_root) if shared_root is not None else SAMPLE_TRANSACTIONS.parent / "shared"
    app = FastAPI(title="orchestrator service", version="1.0.0")

    def _make_client() -> Any:
        if client_factory is not None:
            return client_factory()
        from agents.client import HttpPipelineClient  # local: avoids import cycle

        return HttpPipelineClient()

    @app.get("/health/live")
    def live() -> dict[str, str]:
        return {"status": "alive", "agent": orchestrator.AGENT_NAME}

    @app.get("/health/ready")
    def ready() -> dict[str, str]:
        return {"status": "ready", "agent": orchestrator.AGENT_NAME}

    def _bad_gateway(exc: Exception, correlation_id: str) -> JSONResponse:
        return JSONResponse(
            status_code=502,
            content={
                "errorCode": "PIPELINE_AGENT_UNAVAILABLE",
                "message": f"A pipeline agent could not be reached: {exc}",
                "correlationId": correlation_id,
            },
        )

    @app.post(PIPELINE_RUN_ROUTE)
    def run(request: PipelineRunRequest, http_request: Request) -> Any:
        """Submit a batch (or the bundled samples) and return the run summary."""
        correlation_id = http_request.headers.get("x-correlation-id") or str(uuid.uuid4())
        if request.transactions is not None:
            transactions = request.transactions
        else:
            transactions = orchestrator.load_transactions(SAMPLE_TRANSACTIONS)

        client = _make_client()
        try:
            return orchestrator.run_pipeline(client, transactions, shared)
        except Exception as exc:  # downstream agent unreachable / failed
            return _bad_gateway(exc, correlation_id)
        finally:
            client.close()

    @app.post(TRANSACTIONS_ROUTE, status_code=201)
    def submit_transaction(transaction: dict[str, Any], http_request: Request, response: Response) -> Any:
        """Submit one transaction, run it through the chain, return its result."""
        correlation_id = http_request.headers.get("x-correlation-id") or str(uuid.uuid4())
        txn_id = str(transaction.get("transaction_id", "UNKNOWN"))
        client = _make_client()
        try:
            final = orchestrator.process_one(client, shared, transaction)
        except Exception as exc:
            return _bad_gateway(exc, correlation_id)
        finally:
            client.close()
        response.headers["Location"] = f"{TRANSACTIONS_ROUTE}/{txn_id}"
        return final

    @app.get(TRANSACTIONS_ROUTE + "/{transaction_id}")
    def get_transaction(transaction_id: str) -> Any:
        """Retrieve the stored result of a previously processed transaction."""
        path = shared / "results" / f"{transaction_id}.json"
        if not path.exists():
            return JSONResponse(
                status_code=404,
                content={
                    "errorCode": "TRANSACTION_NOT_FOUND",
                    "message": f"No result for transaction '{transaction_id}'.",
                    "correlationId": str(uuid.uuid4()),
                },
            )
        return common.read_message(path)

    @app.get(PIPELINE_SUMMARY_ROUTE)
    def get_summary() -> Any:
        """Retrieve the latest run summary."""
        path = shared / "results" / common.SUMMARY_FILE
        if not path.exists():
            return JSONResponse(
                status_code=404,
                content={
                    "errorCode": "SUMMARY_NOT_FOUND",
                    "message": "No pipeline summary yet. Run the pipeline first.",
                    "correlationId": str(uuid.uuid4()),
                },
            )
        return common.read_message(path)

    return app


def orchestrator_run_url(host: str = DEFAULT_HOST) -> str:
    """Return the master-agent run URL on ``host``."""
    return f"http://{host}:{ORCHESTRATOR_PORT}{PIPELINE_RUN_ROUTE}"


def _main(argv: list[str] | None = None) -> int:  # pragma: no cover - launcher
    import argparse

    import uvicorn

    parser = argparse.ArgumentParser(description="Run one agent REST service.")
    parser.add_argument(
        "agent",
        choices=[*sorted(SERVICES), "orchestrator"],
        help="Agent to serve.",
    )
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=None)
    args = parser.parse_args(argv)

    if args.agent == "orchestrator":
        app = create_orchestrator_app()
        port = args.port or ORCHESTRATOR_PORT
    else:
        app = create_app(args.agent)
        port = args.port or SERVICES[args.agent][2]

    uvicorn.run(app, host=args.host, port=port, log_level="warning")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(_main())
