"""Multi-agent banking transaction pipeline.

Five cooperating agents process raw transactions, each exposed as its own REST
service (see :mod:`agents.rest`) and chained over HTTP:

    transaction_validator -> fraud_detector -> compliance_checker
        -> settlement_processor -> reporting_agent

Each agent exposes a pure ``process_message(message: dict) -> dict`` function
so it can be unit-tested in isolation; the REST layer is a thin wrapper over it
and :mod:`integrator` is the HTTP client that drives the chain and persists the
outcome to ``shared/results``.
"""

from . import common  # noqa: F401

__all__ = ["common"]
