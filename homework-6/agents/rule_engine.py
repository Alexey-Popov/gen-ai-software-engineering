"""Configurable rule engine.

The pipeline's thresholds, limits and block-lists are **not** hard-coded in the
agents — they live in ``config/rules.json`` and are loaded through this module.
Editing that file (different fraud thresholds, an extra blocked account, a new
allowed currency, ...) changes the agents' behaviour without touching any code.

The file has one section per rule-driven agent::

    {
      "policy":     {... new policy agent ...},
      "fraud":      {... fraud detector ...},
      "compliance": {... compliance checker ...},
      "settlement": {... settlement processor ...}
    }

Agents call :func:`section` to read their slice. The default config is loaded
once and cached; tests pass an explicit section dict to override it.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

#: Default location of the rule configuration.
DEFAULT_RULES_PATH = Path(__file__).resolve().parent.parent / "config" / "rules.json"

_cache: dict[str, Any] | None = None


def load_rules(path: Path | None = None) -> dict[str, Any]:
    """Read and return the rule configuration from ``path`` (uncached)."""
    rules_path = Path(path) if path is not None else DEFAULT_RULES_PATH
    return json.loads(rules_path.read_text(encoding="utf-8"))


def get_rules() -> dict[str, Any]:
    """Return the cached default rule configuration (loaded on first use)."""
    global _cache
    if _cache is None:
        _cache = load_rules()
    return _cache


def reset_cache() -> None:
    """Drop the cached configuration (used by tests after editing the file)."""
    global _cache
    _cache = None


def section(name: str, rules: dict[str, Any] | None = None) -> dict[str, Any]:
    """Return one rule section.

    Args:
        name: section key (``"policy"`` / ``"fraud"`` / ``"compliance"`` /
            ``"settlement"``).
        rules: when given, this section dict is returned as-is (test override);
            otherwise the section is read from the cached default config.
    """
    if rules is not None:
        return rules
    return get_rules()[name]
