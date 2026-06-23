"""Clients the integrator uses to talk to the agent REST services.

Two interchangeable implementations share the same surface
(``process`` / ``summary`` / ``close``):

* :class:`HttpPipelineClient` — real HTTP calls via ``httpx``; used when the
  services run as separate processes (see :mod:`run_services`).
* :class:`InProcessPipelineClient` — drives each FastAPI app through Starlette's
  ``TestClient`` in-process; used by the test-suite so the full REST contract
  (routing, validation, status codes) is exercised without binding sockets.
"""

from __future__ import annotations

from typing import Any

from agents import rest


class HttpPipelineClient:
    """Calls the agent services over real HTTP using a shared ``httpx`` client."""

    def __init__(
        self,
        host: str = rest.DEFAULT_HOST,
        timeout: float = 10.0,
        client: Any | None = None,
    ) -> None:
        import httpx

        self._host = host
        self._client = client if client is not None else httpx.Client(timeout=timeout)

    def process(self, agent_name: str, message: dict[str, Any]) -> dict[str, Any]:
        """POST ``message`` to ``agent_name`` and return the next message."""
        response = self._client.post(rest.endpoint_url(agent_name, self._host), json=message)
        response.raise_for_status()
        return response.json()

    def summary(self, finals: list[dict[str, Any]]) -> dict[str, Any]:
        """POST the final messages to the reporting summary endpoint."""
        response = self._client.post(rest.summary_url(self._host), json={"items": finals})
        response.raise_for_status()
        return response.json()

    def close(self) -> None:
        self._client.close()


class InProcessPipelineClient:
    """Routes calls to in-process FastAPI apps via Starlette's ``TestClient``."""

    def __init__(self) -> None:
        from fastapi.testclient import TestClient

        self._clients = {name: TestClient(rest.create_app(name)) for name in rest.SERVICES}

    def process(self, agent_name: str, message: dict[str, Any]) -> dict[str, Any]:
        _module, route, _port = rest.SERVICES[agent_name]
        response = self._clients[agent_name].post(route, json=message)
        response.raise_for_status()
        return response.json()

    def summary(self, finals: list[dict[str, Any]]) -> dict[str, Any]:
        response = self._clients["reporting_agent"].post(
            rest.SUMMARY_ROUTE, json={"items": finals}
        )
        response.raise_for_status()
        return response.json()

    def close(self) -> None:
        for client in self._clients.values():
            client.close()
