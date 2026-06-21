"""Multi-agent banking transaction pipeline.

Five cooperating agents process raw transactions through a file-based
message protocol:

    transaction_validator -> fraud_detector -> compliance_checker
        -> settlement_processor -> reporting_agent

Each agent exposes a pure ``process_message(message: dict) -> dict`` function
so it can be unit-tested in isolation, while :mod:`integrator` drives the
file movement through ``shared/{input,processing,output,results}``.
"""

from . import common  # noqa: F401

__all__ = ["common"]
